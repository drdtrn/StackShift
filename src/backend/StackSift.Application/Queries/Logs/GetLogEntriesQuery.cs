using MediatR;
using StackSift.Application.Common;
using StackSift.Application.DTOs;
using StackSift.Application.Mapping;

namespace StackSift.Application.Queries.Logs;

public record GetLogEntriesQuery(LogQueryFilters Filters, int Limit, string? Cursor)
    : IRequest<CursorPaginatedResponse<LogEntryDto>>;

public class GetLogEntriesQueryHandler(IUnitOfWork uow)
    : IRequestHandler<GetLogEntriesQuery, CursorPaginatedResponse<LogEntryDto>>
{
    public async Task<CursorPaginatedResponse<LogEntryDto>> Handle(GetLogEntriesQuery request, CancellationToken ct)
    {
        var orgFilters = request.Filters with { };

        var (items, nextCursor, hasMore) = await uow.LogEntries.SearchAsync(
            orgFilters, request.Limit, request.Cursor, ct);

        var dtos = items.Select(le => le.ToDto()).ToList();

        return new CursorPaginatedResponse<LogEntryDto>(dtos, nextCursor, hasMore);
    }
}
