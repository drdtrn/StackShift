using MediatR;
using StackSift.Application.DTOs;
using StackSift.Domain.Interfaces;

namespace StackSift.Application.Queries.LogSources;

public record GetOrganizationLogSourcesQuery : IRequest<List<LogSourceDto>>;

public class GetOrganizationLogSourcesQueryHandler(IUnitOfWork uow)
    : IRequestHandler<GetOrganizationLogSourcesQuery, List<LogSourceDto>>
{
    public async Task<List<LogSourceDto>> Handle(GetOrganizationLogSourcesQuery request, CancellationToken ct)
    {
        var sources = await uow.LogSources.GetByOrganizationAsync(ct);
        return sources.Select(ls => ls.ToDto()).ToList();
    }
}
