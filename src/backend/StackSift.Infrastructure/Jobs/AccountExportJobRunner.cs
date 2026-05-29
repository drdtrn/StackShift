using System.IO.Compression;
using System.Text;
using System.Text.Json;
using Hangfire;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using StackSift.Application.Interfaces;
using StackSift.Domain.Entities;
using StackSift.Domain.Enums;
using StackSift.Infrastructure.Persistence;

namespace StackSift.Infrastructure.Jobs;

/// <summary>
/// Builds the GDPR Article 15 data export bundle for a single user and
/// uploads it to the exports bucket. v1 builds the zip in memory; the row
/// limits below cap the build at well below the per-pod memory budget.
/// A future streaming version uses S3 multipart upload to remove the cap.
/// </summary>
public sealed class AccountExportJobRunner(
    AppDbContext db,
    IAccountExportStorage storage,
    ILogger<AccountExportJobRunner> log) : IAccountExportJobRunner
{
    private const int MaxRowsPerTable = 100_000;
    private static readonly TimeSpan SignedUrlTtl = TimeSpan.FromHours(24);

    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        WriteIndented = true,
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
    };

    [AutomaticRetry(Attempts = 0)]
    public async Task RunAsync(Guid requestId, CancellationToken ct)
    {
        var request = await db.AccountExportRequests.FirstOrDefaultAsync(r => r.Id == requestId, ct);
        if (request is null)
        {
            log.LogWarning("AccountExportJobRunner: request {RequestId} not found; skipping.", requestId);
            return;
        }

        if (request.Status != AccountExportStatus.Pending)
        {
            log.LogInformation(
                "AccountExportJobRunner: request {RequestId} is already in status {Status}; skipping.",
                requestId, request.Status);
            return;
        }

        try
        {
            log.LogInformation("AccountExportJobRunner: building export for user {UserId} (request {RequestId}).",
                request.UserId, request.Id);

            await using var zipStream = await BuildBundleAsync(request.UserId, ct);
            var upload = await storage.UploadAsync(request.UserId, request.Id, zipStream, ct);
            var signedUrl = await storage.GeneratePresignedUrlAsync(upload.ObjectKey, SignedUrlTtl, ct);

            request.Status = AccountExportStatus.Ready;
            request.CompletedAt = DateTimeOffset.UtcNow;
            request.ObjectKey = upload.ObjectKey;
            request.SignedUrl = signedUrl;
            request.ExpiresAt = DateTimeOffset.UtcNow.Add(SignedUrlTtl);
            request.SizeBytes = upload.SizeBytes;
            request.ManifestSha256 = upload.Sha256Hex;
            await db.SaveChangesAsync(ct);

            log.LogInformation(
                "AccountExportJobRunner: request {RequestId} ready — {Size} bytes at {Key}.",
                request.Id, upload.SizeBytes, upload.ObjectKey);
        }
        catch (Exception ex)
        {
            log.LogError(ex, "AccountExportJobRunner: request {RequestId} failed.", request.Id);
            request.Status = AccountExportStatus.Failed;
            request.CompletedAt = DateTimeOffset.UtcNow;
            request.FailureReason = ex.Message.Length > 1000 ? ex.Message[..1000] : ex.Message;
            await db.SaveChangesAsync(ct);
            throw;
        }
    }

    private async Task<MemoryStream> BuildBundleAsync(Guid userId, CancellationToken ct)
    {
        var output = new MemoryStream();
        var manifest = new Dictionary<string, ExportTableInfo>();

        using (var archive = new ZipArchive(output, ZipArchiveMode.Create, leaveOpen: true))
        {
            // profile.json — the user row itself, sans any credential material.
            var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId, ct);
            if (user is null)
                throw new InvalidOperationException($"User {userId} not found.");
            await WriteJsonEntryAsync(archive, "profile.json", new
            {
                user.Id,
                user.Email,
                user.DisplayName,
                user.AvatarUrl,
                Role = user.Role.ToString(),
                user.LastLoginAt,
                user.OrganizationId,
                user.CreatedAt,
            }, manifest, ct);

            var orgId = user.OrganizationId;

            await WriteTableAsync(archive, "organizations.csv", manifest,
                await db.Organizations.AsNoTracking()
                    .Where(o => o.Id == orgId)
                    .Take(MaxRowsPerTable).ToListAsync(ct),
                row => new[]
                {
                    row.Id.ToString(),
                    row.Name ?? string.Empty,
                    row.Plan.ToString(),
                    row.CreatedAt.ToString("O"),
                },
                ["id", "name", "plan", "created_at"], ct);

            await WriteTableAsync(archive, "projects.csv", manifest,
                await db.Projects.AsNoTracking()
                    .Where(p => p.OrganizationId == orgId)
                    .Take(MaxRowsPerTable).ToListAsync(ct),
                row => new[]
                {
                    row.Id.ToString(),
                    row.Name ?? string.Empty,
                    row.Description ?? string.Empty,
                    row.CreatedAt.ToString("O"),
                },
                ["id", "name", "description", "created_at"], ct);

            await WriteTableAsync(archive, "log_sources.csv", manifest,
                await db.LogSources.AsNoTracking()
                    .Where(s => s.OrganizationId == orgId)
                    .Take(MaxRowsPerTable).ToListAsync(ct),
                row => new[]
                {
                    row.Id.ToString(),
                    row.ProjectId.ToString(),
                    row.Name ?? string.Empty,
                    row.Type.ToString(),
                    row.KeyPrefix ?? string.Empty,
                    row.CreatedAt.ToString("O"),
                },
                ["id", "project_id", "name", "type", "key_prefix", "created_at"], ct);

            await WriteTableAsync(archive, "alerts.csv", manifest,
                await db.Alerts.AsNoTracking()
                    .Where(a => a.OrganizationId == orgId)
                    .Take(MaxRowsPerTable).ToListAsync(ct),
                row => new[]
                {
                    row.Id.ToString(),
                    row.ProjectId.ToString(),
                    row.Title ?? string.Empty,
                    row.Severity.ToString(),
                    row.FiredAt.ToString("O"),
                },
                ["id", "project_id", "title", "severity", "fired_at"], ct);

            await WriteTableAsync(archive, "incidents.csv", manifest,
                await db.Incidents.AsNoTracking()
                    .Where(i => i.OrganizationId == orgId)
                    .Take(MaxRowsPerTable).ToListAsync(ct),
                row => new[]
                {
                    row.Id.ToString(),
                    row.Status.ToString(),
                    row.CreatedAt.ToString("O"),
                },
                ["id", "status", "created_at"], ct);

            await WriteTableAsync(archive, "ai_analyses.csv", manifest,
                await db.AiAnalyses.AsNoTracking()
                    .Where(a => a.OrganizationId == orgId)
                    .Take(MaxRowsPerTable).ToListAsync(ct),
                row => new[]
                {
                    row.Id.ToString(),
                    row.Status.ToString(),
                    row.CreatedAt.ToString("O"),
                },
                ["id", "status", "created_at"], ct);

            await WriteTableAsync(archive, "audit_events.csv", manifest,
                await db.AuditLogEntries.AsNoTracking()
                    .Where(a => a.ActorUserId == userId)
                    .Take(MaxRowsPerTable).ToListAsync(ct),
                row => new[]
                {
                    row.Id.ToString(),
                    row.Event.ToString(),
                    row.OccurredAt.ToString("O"),
                    row.ActorEmail ?? string.Empty,
                },
                ["id", "event", "occurred_at", "actor_email"], ct);

            // Manifest is written last so it knows every other entry's row count.
            await WriteJsonEntryAsync(archive, "export-manifest.json", new
            {
                user_id = userId,
                generated_at = DateTimeOffset.UtcNow,
                generator = "StackSift.Infrastructure.Jobs.AccountExportJobRunner",
                tables = manifest,
            }, manifest: null, ct);
        }

        output.Position = 0;
        return output;
    }

    private static async Task WriteTableAsync<TRow>(
        ZipArchive archive,
        string entryName,
        Dictionary<string, ExportTableInfo> manifest,
        IReadOnlyList<TRow> rows,
        Func<TRow, string[]> project,
        string[] headers,
        CancellationToken ct)
    {
        var entry = archive.CreateEntry(entryName, CompressionLevel.Optimal);
        await using var entryStream = entry.Open();
        await using var writer = new StreamWriter(entryStream, new UTF8Encoding(encoderShouldEmitUTF8Identifier: false));

        await writer.WriteLineAsync(string.Join(',', headers));
        foreach (var row in rows)
        {
            await writer.WriteLineAsync(string.Join(',', project(row).Select(EscapeCsv)));
        }
        await writer.FlushAsync(ct);

        manifest[entryName] = new ExportTableInfo(rows.Count);
    }

    private static async Task WriteJsonEntryAsync(
        ZipArchive archive,
        string entryName,
        object payload,
        Dictionary<string, ExportTableInfo>? manifest,
        CancellationToken ct)
    {
        var entry = archive.CreateEntry(entryName, CompressionLevel.Optimal);
        await using var entryStream = entry.Open();
        await JsonSerializer.SerializeAsync(entryStream, payload, JsonOpts, ct);
        manifest?.TryAdd(entryName, new ExportTableInfo(1));
    }

    private static string EscapeCsv(string value)
    {
        if (string.IsNullOrEmpty(value)) return string.Empty;
        var needsQuote = value.Contains(',') || value.Contains('"') || value.Contains('\n') || value.Contains('\r');
        if (!needsQuote) return value;
        return "\"" + value.Replace("\"", "\"\"") + "\"";
    }

    private sealed record ExportTableInfo(int RowCount);
}
