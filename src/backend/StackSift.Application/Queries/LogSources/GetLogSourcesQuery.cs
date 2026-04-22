using MediatR;
using StackSift.Application.DTOs;
using StackSift.Application.Mapping;

namespace StackSift.Application.Queries.LogSources;

public record GetLogSourcesQuery(Guid ProjectId) : IRequest<List<LogSourceDto>>;

public class GetLogSourcesQueryHandler(IUnitOfWork uow)
    : IRequestHandler<GetLogSourcesQuery, List<LogSourceDto>>
{
    public async Task<List<LogSourceDto>> Handle(GetLogSourcesQuery request, CancellationToken ct)
    {
        var sources = await uow.LogSources.GetByProjectIdAsync(request.ProjectId, ct);

        return sources.Select(ls => ls.ToDto()).ToList();
    }
}
