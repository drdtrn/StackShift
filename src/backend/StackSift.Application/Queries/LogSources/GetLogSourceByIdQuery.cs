using MediatR;
using StackSift.Application.DTOs;
using StackSift.Domain.Interfaces;
using StackSift.Domain.Interfaces.Repositories;

namespace StackSift.Application.Queries.LogSources;

public record GetLogSourceByIdQuery(Guid Id) : IRequest<LogSourceDto>;

public class GetLogSourceByIdQueryHandler(IUnitOfWork uow, ICurrentUserService currentUser)
    : IRequestHandler<GetLogSourceByIdQuery, LogSourceDto>
{
    public async Task<LogSourceDto> Handle(GetLogSourceByIdQuery request, CancellationToken ct)
    {
        var logSource = await uow.LogSources.GetByIdAsync(request.Id, ct)
            ?? throw new NotFoundException(nameof(LogSource), request.Id);

        if (logSource.OrganizationId != currentUser.OrganizationId)
            throw new NotFoundException(nameof(LogSource), request.Id);

        return logSource.ToDto();
    }
}
