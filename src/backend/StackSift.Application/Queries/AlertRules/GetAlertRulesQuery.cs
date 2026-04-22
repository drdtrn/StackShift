using MediatR;
using StackSift.Application.DTOs;
using StackSift.Application.Mapping;

namespace StackSift.Application.Queries.AlertRules;

public record GetAlertRulesQuery(Guid ProjectId) : IRequest<List<AlertRuleDto>>;

public class GetAlertRulesQueryHandler(IUnitOfWork uow)
    : IRequestHandler<GetAlertRulesQuery, List<AlertRuleDto>>
{
    public async Task<List<AlertRuleDto>> Handle(GetAlertRulesQuery request, CancellationToken ct)
    {
        var rules = await uow.AlertRules.GetActiveByProjectIdAsync(request.ProjectId, ct);

        return rules.Select(r => r.ToDto()).ToList();
    }
}
