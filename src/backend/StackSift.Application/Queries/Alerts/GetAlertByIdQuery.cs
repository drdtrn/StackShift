using MediatR;
using StackSift.Application.DTOs;
using StackSift.Application.Mapping;
using StackSift.Domain.Entities;
using StackSift.Domain.Exceptions;
using StackSift.Domain.Interfaces;
using StackSift.Domain.Interfaces.Repositories;

namespace StackSift.Application.Queries.Alerts;

public record GetAlertByIdQuery(Guid Id) : IRequest<AlertDto>;

public class GetAlertByIdQueryHandler(IUnitOfWork uow, ICurrentUserService currentUser) : IRequestHandler<GetAlertByIdQuery, AlertDto>
{
    public async Task<AlertDto> Handle(GetAlertByIdQuery request, CancellationToken ct)
    {
        var alert = await uow.Alerts.GetByIdAsync(request.Id, ct)
            ?? throw new NotFoundException(nameof(Alert), request.Id);

        if (alert.OrganizationId != currentUser.OrganizationId)
        {
            throw new NotFoundException(nameof(Alert), request.Id);
        }
        return alert.ToDto();
    }
}