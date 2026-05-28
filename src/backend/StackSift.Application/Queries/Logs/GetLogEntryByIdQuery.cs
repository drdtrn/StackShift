using MediatR;
using StackSift.Application.DTOs;
using StackSift.Application.Mapping;
using StackSift.Domain.Entities;

namespace StackSift.Application.Queries.Logs;

public record GetLogEntryByIdQuery(Guid Id) : IRequest<LogEntryDto>;

public class GetLogEntryByIdQueryHandler(IUnitOfWork uow)
    : IRequestHandler<GetLogEntryByIdQuery, LogEntryDto>
{
    public async Task<LogEntryDto> Handle(GetLogEntryByIdQuery request, CancellationToken ct)
    {
        var entry = await uow.LogEntries.GetByIdAsync(request.Id, ct)
            ?? throw new NotFoundException(nameof(LogEntry), request.Id);

        return entry.ToDto();
    }
}
