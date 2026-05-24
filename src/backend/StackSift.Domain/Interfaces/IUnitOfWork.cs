using StackSift.Domain.Interfaces.Repositories;

namespace StackSift.Domain.Interfaces;

public interface IUnitOfWork
{
    IOrganizationRepository Organizations { get; }
    IProjectRepository Projects { get; }
    ILogSourceRepository LogSources { get; }
    ILogEntryRepository LogEntries { get; }
    IAlertRuleRepository AlertRules { get; }
    IAlertRepository Alerts { get; }
    IIncidentRepository Incidents { get; }
    IAiAnalysisRepository AiAnalyses { get; }
    IUserRepository Users { get; }
    IInvitationRepository Invitations { get; }
    Task<int> SaveChangesAsync(CancellationToken ct = default);
}
