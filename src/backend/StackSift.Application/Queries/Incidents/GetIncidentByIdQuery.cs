using MediatR;
using StackSift.Application.DTOs;
using StackSift.Application.Mapping;

namespace StackSift.Application.Queries.Incidents;

public record GetIncidentByIdQuery(Guid Id) : IRequest<IncidentDto>;

public class GetIncidentByIdQueryHandler(IUnitOfWork uow, ICurrentUserService currentUser)
    : IRequestHandler<GetIncidentByIdQuery, IncidentDto>
{
    public async Task<IncidentDto> Handle(GetIncidentByIdQuery request, CancellationToken ct)
    {
        var incident = await uow.Incidents.GetByIdAsync(request.Id, ct)
            ?? throw new NotFoundException(nameof(Incident), request.Id);

        // Cross-tenant: return 404 rather than 403 to prevent ID enumeration
        if (incident.OrganizationId != currentUser.OrganizationId)
            throw new NotFoundException(nameof(Incident), request.Id);

        return incident.ToDto();
    }
}
