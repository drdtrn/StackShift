using Amazon.S3;
using Amazon.S3.Model;
using Elastic.Clients.Elasticsearch;
using Hangfire;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using StackSift.Application.Common;
using StackSift.Application.Interfaces;
using StackSift.Domain.Entities;
using StackSift.Domain.Enums;
using StackSift.Domain.Interfaces;
using StackSift.Infrastructure.Persistence;
using StackSift.Infrastructure.Storage;

namespace StackSift.Infrastructure.Jobs;

public sealed class AccountErasureJob(
    AppDbContext db,
    IAccountErasureContext erasures,
    IAccountErasureService erasureService,
    ElasticsearchClient es,
    IAmazonS3 s3,
    IOptions<S3StorageOptions> s3Opts,
    TimeProvider time,
    ILogger<AccountErasureJob> log,
    ICurrentOrgProvider orgProvider) : IAccountErasureJobRunner
{
    [AutomaticRetry(Attempts = 0)]
    public async Task ExecuteAsync(CancellationToken ct)
    {
        using var systemScope = orgProvider.EnterSystemScope(nameof(AccountErasureJob));
        var now = time.GetUtcNow();
        var due = await erasures.ListReadyForHardDeleteAsync(now, ct);

        log.LogInformation(
            "AccountErasureJob: {Count} requests past grace; processing.",
            due.Count);

        foreach (var request in due)
        {
            try
            {
                await ProcessOneAsync(request, ct);
            }
            catch (Exception ex)
            {
                log.LogError(ex,
                    "AccountErasureJob: request {RequestId} for user {UserId} failed; flagging for human review.",
                    request.Id, request.UserId);
                request.Status = AccountErasureStatus.Failed;
                request.FailureReason = ex.Message.Length > 1000 ? ex.Message[..1000] : ex.Message;
                request.CompletedAt = now;
                await erasures.SaveChangesAsync(ct);
            }
        }
    }

    private async Task ProcessOneAsync(AccountErasureRequest request, CancellationToken ct)
    {
        var userId = request.UserId;
        var user = await db.Users
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (user is null)
        {
            log.LogWarning(
                "AccountErasureJob: request {RequestId} — user {UserId} already gone; marking complete.",
                request.Id, userId);
            request.Status = AccountErasureStatus.Completed;
            request.CompletedAt = time.GetUtcNow();
            await erasures.SaveChangesAsync(ct);
            return;
        }

        var orgId = user.OrganizationId;
        var soleOwnerWithOthers = false;

        if (orgId.HasValue)
        {
            var memberCount = await db.Users
                .IgnoreQueryFilters()
                .Where(u => u.OrganizationId == orgId.Value && u.Id != userId && !u.IsDeleted)
                .CountAsync(ct);

            var isOwner = user.Role == UserRole.Owner;
            soleOwnerWithOthers = isOwner && memberCount > 0;

            if (soleOwnerWithOthers)
            {
                log.LogWarning(
                    "AccountErasureJob: request {RequestId} — user {UserId} is sole owner of org {OrgId} with {Others} active members; pausing for review.",
                    request.Id, userId, orgId.Value, memberCount);

                request.Status = AccountErasureStatus.AwaitingHumanReview;
                request.AwaitingReviewReason =
                    $"sole_owner_of_org_with_{memberCount}_members";
                await erasures.SaveChangesAsync(ct);
                return;
            }
        }

        await using var tx = await db.Database.BeginTransactionAsync(ct);

        if (orgId.HasValue)
        {
            await CascadeOwnerOnlyOrgAsync(orgId.Value, ct);
        }

        // Anonymise audit events authored by the user. The row IDs are
        // preserved so we still satisfy Stripe's 7-year transaction-record
        // requirement, but the actor email and IP become placeholders.
        var placeholderEmail = Anonymiser.EmailForDeletedUser(userId);
        await db.AuditLogEntries
            .Where(a => a.ActorUserId == userId)
            .ExecuteUpdateAsync(s => s
                .SetProperty(a => a.ActorEmail, placeholderEmail)
                .SetProperty(a => a.ActorUserId, (Guid?)null), ct);

        // Hard-delete the user row. IgnoreQueryFilters lets us issue a real
        // DELETE on a soft-deleted entity; the AppDbContext SaveChangesAsync
        // override turns Removed → Modified+IsDeleted on AuditableEntity, so we
        // bypass it with ExecuteDeleteAsync.
        await db.Users
            .IgnoreQueryFilters()
            .Where(u => u.Id == userId)
            .ExecuteDeleteAsync(ct);

        request.Status = AccountErasureStatus.Completed;
        request.CompletedAt = time.GetUtcNow();
        request.CancellationTokenHash = null;
        await erasures.SaveChangesAsync(ct);

        await tx.CommitAsync(ct);

        // External-system effects after the transaction commits. A failure
        // here leaves orphan rows in Keycloak but the user row is already
        // gone from Postgres — that is the safer side of the trade.
        try
        {
            await erasureService.DeleteKeycloakUserAsync(userId, ct);
        }
        catch (Exception ex)
        {
            log.LogError(ex,
                "AccountErasureJob: Keycloak delete failed for {UserId} after Postgres erasure; orphan present.",
                userId);
        }

        log.LogInformation(
            "AccountErasureJob: request {RequestId} — user {UserId} hard-deleted; org cascade applied.",
            request.Id, userId);
    }

    private async Task CascadeOwnerOnlyOrgAsync(Guid orgId, CancellationToken ct)
    {
        // ES index per org.
        try
        {
            await es.Indices.DeleteAsync($"stacksift-logs-{orgId}", ct);
        }
        catch (Exception ex)
        {
            log.LogWarning(ex,
                "AccountErasureJob: ES index delete failed for org {OrgId}; continuing.",
                orgId);
        }

        // MinIO object prefix.
        try
        {
            await DeleteS3PrefixAsync($"orgs/{orgId}/", ct);
        }
        catch (Exception ex)
        {
            log.LogWarning(ex,
                "AccountErasureJob: S3 prefix delete failed for org {OrgId}; continuing.",
                orgId);
        }

        // Postgres rows. EF cascade handles projects → log_sources → alerts →
        // incidents → ai_analyses by OrganizationId because every entity in
        // the chain has the FK set. We issue an explicit ExecuteDeleteAsync
        // for each so the AuditableEntity soft-delete override does not
        // intercept them and leave dangling rows.
        await db.AiAnalyses.Where(a => a.OrganizationId == orgId).ExecuteDeleteAsync(ct);
        await db.Alerts.Where(a => a.OrganizationId == orgId).ExecuteDeleteAsync(ct);
        await db.Incidents.Where(i => i.OrganizationId == orgId).ExecuteDeleteAsync(ct);
        await db.AlertRules.Where(r => r.OrganizationId == orgId).ExecuteDeleteAsync(ct);
        await db.LogSources.Where(s => s.OrganizationId == orgId).ExecuteDeleteAsync(ct);
        await db.Projects.Where(p => p.OrganizationId == orgId).ExecuteDeleteAsync(ct);

        // Audit rows scoped to the org survive at the floor table layer (the
        // RetentionEnforcementJob hard-deletes past 365 days) — leaving them
        // here would defeat the audit trail.

        await db.Organizations
            .IgnoreQueryFilters()
            .Where(o => o.Id == orgId)
            .ExecuteDeleteAsync(ct);
    }

    private async Task DeleteS3PrefixAsync(string prefix, CancellationToken ct)
    {
        var bucket = s3Opts.Value.BucketName;
        string? continuation = null;
        do
        {
            var list = await s3.ListObjectsV2Async(new ListObjectsV2Request
            {
                BucketName = bucket,
                Prefix = prefix,
                ContinuationToken = continuation,
            }, ct);

            if (list.S3Objects.Count == 0) return;

            await s3.DeleteObjectsAsync(new DeleteObjectsRequest
            {
                BucketName = bucket,
                Objects = list.S3Objects.Select(o => new KeyVersion { Key = o.Key }).ToList(),
            }, ct);

            continuation = list.IsTruncated == true ? list.NextContinuationToken : null;
        }
        while (continuation is not null);
    }
}
