using StackSift.Domain.Interfaces;
using StackSift.Domain.Interfaces.Repositories;
using StackSift.Infrastructure.Persistence.Repositories;

namespace StackSift.Infrastructure.Persistence;

public class UnitOfWork(
    AppDbContext context,
    IOrganizationRepository organizations,
    IProjectRepository projects,
    ILogSourceRepository logSources,
    ILogEntryRepository logEntries,
    IAlertRuleRepository alertRules,
    IAlertRepository alerts,
    IIncidentRepository incidents,
    IAiAnalysisRepository aiAnalyses,
    IUserRepository users,
    IInvitationRepository invitations) : IUnitOfWork
{
    public IOrganizationRepository Organizations { get; } = organizations;
    public IProjectRepository Projects { get; } = projects;
    public ILogSourceRepository LogSources { get; } = logSources;
    public ILogEntryRepository LogEntries { get; } = logEntries;
    public IAlertRuleRepository AlertRules { get; } = alertRules;
    public IAlertRepository Alerts { get; } = alerts;
    public IIncidentRepository Incidents { get; } = incidents;
    public IAiAnalysisRepository AiAnalyses { get; } = aiAnalyses;
    public IUserRepository Users { get; } = users;
    public IInvitationRepository Invitations { get; } = invitations;

    public Task<int> SaveChangesAsync(CancellationToken ct = default)
        => context.SaveChangesAsync(ct);
}
