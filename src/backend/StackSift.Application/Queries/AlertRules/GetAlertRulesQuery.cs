using MediatR;
using StackSift.Application.DTOs;

namespace StackSift.Application.Queries.AlertRules;

public record GetAlertRulesQuery(Guid ProjectId) : IRequest<List<AlertRuleDto>>;

public class GetAlertRulesQueryHandler(IUnitOfWork uow, ICurrentUserService currentUser)
    : IRequestHandler<GetAlertRulesQuery, List<AlertRuleDto>>
{
    public async Task<List<AlertRuleDto>> Handle(GetAlertRulesQuery request, CancellationToken ct)
    {
        var project = await uow.Projects.GetByIdAsync(request.ProjectId, ct)
            ?? throw new NotFoundException(nameof(Project), request.ProjectId);

        if (project.OrganizationId != currentUser.OrganizationId)
            throw new NotFoundException(nameof(Project), request.ProjectId);

        var rules = await uow.AlertRules.GetActiveByProjectIdAsync(request.ProjectId, ct);

        return rules.Select(r => r.ToDto()).ToList();
    }
}
