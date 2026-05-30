using Microsoft.EntityFrameworkCore;
using StackSift.Domain.Common;
using StackSift.Domain.Entities;
using StackSift.Domain.Interfaces;

namespace StackSift.Infrastructure.Persistence;

public class AppDbContext(
    DbContextOptions<AppDbContext> options,
    ICurrentUserService currentUser,
    ICurrentOrgProvider orgProvider) : DbContext(options)
{
    // Referenced by the tenant query filters below. EF re-reads these from the
    // context instance per query, so EnterSystemScope toggles take effect live.
    private Guid CurrentOrgId => orgProvider.OrgId;
    private bool TenantFilterEnabled => orgProvider.TenantFilterEnabled;

    public DbSet<Organization> Organizations => Set<Organization>();
    public DbSet<User> Users => Set<User>();
    public DbSet<Project> Projects => Set<Project>();
    public DbSet<LogSource> LogSources => Set<LogSource>();
    public DbSet<LogEntry> LogEntries => Set<LogEntry>();
    public DbSet<AlertRule> AlertRules => Set<AlertRule>();
    public DbSet<Alert> Alerts => Set<Alert>();
    public DbSet<Incident> Incidents => Set<Incident>();
    public DbSet<AiAnalysis> AiAnalyses => Set<AiAnalysis>();
    public DbSet<StripeWebhookEvent> StripeWebhookEvents => Set<StripeWebhookEvent>();
    public DbSet<Invitation> Invitations => Set<Invitation>();
    public DbSet<AuditLogEntry> AuditLogEntries => Set<AuditLogEntry>();
    public DbSet<AccountExportRequest> AccountExportRequests => Set<AccountExportRequest>();
    public DbSet<AccountErasureRequest> AccountErasureRequests => Set<AccountErasureRequest>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasPostgresExtension("vector");
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);

        // Tenant query filter (the ORM-level fail-safe). Combines the soft-delete
        // filter with org-scoping that is active only inside an HTTP request; in
        // background workers TenantFilterEnabled is false so these reduce to the
        // soft-delete filter and cross-org maintenance keeps working.
        modelBuilder.Entity<Project>()
            .HasQueryFilter(e => !e.IsDeleted && (!TenantFilterEnabled || e.OrganizationId == CurrentOrgId));
        modelBuilder.Entity<LogSource>()
            .HasQueryFilter(e => !e.IsDeleted && (!TenantFilterEnabled || e.OrganizationId == CurrentOrgId));
        modelBuilder.Entity<AlertRule>()
            .HasQueryFilter(e => !e.IsDeleted && (!TenantFilterEnabled || e.OrganizationId == CurrentOrgId));
        modelBuilder.Entity<Alert>()
            .HasQueryFilter(e => !e.IsDeleted && (!TenantFilterEnabled || e.OrganizationId == CurrentOrgId));
        modelBuilder.Entity<Incident>()
            .HasQueryFilter(e => !e.IsDeleted && (!TenantFilterEnabled || e.OrganizationId == CurrentOrgId));
        modelBuilder.Entity<AiAnalysis>()
            .HasQueryFilter(e => !e.IsDeleted && (!TenantFilterEnabled || e.OrganizationId == CurrentOrgId));
        modelBuilder.Entity<LogEntry>()
            .HasQueryFilter(e => !e.IsDeleted && (!TenantFilterEnabled || e.OrganizationId == CurrentOrgId));

        base.OnModelCreating(modelBuilder);
    }

    public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        var actor = currentUser.IsAuthenticated ? currentUser.Email : "system";
        var now = DateTimeOffset.UtcNow;

        foreach (var entry in ChangeTracker.Entries<AuditableEntity<Guid>>())
        {
            switch (entry.State)
            {
                case EntityState.Added:
                    entry.Entity.CreatedAt = now;
                    entry.Entity.UpdatedAt = now;
                    entry.Entity.CreatedBy = actor;
                    break;
                case EntityState.Modified:
                    entry.Entity.UpdatedAt = now;
                    break;
                case EntityState.Deleted:
                    entry.State = EntityState.Modified;
                    entry.Entity.IsDeleted = true;
                    entry.Entity.DeletedAt = now;
                    entry.Entity.DeletedBy = actor;
                    break;
            }
        }

        return await base.SaveChangesAsync(cancellationToken);

    }
}
