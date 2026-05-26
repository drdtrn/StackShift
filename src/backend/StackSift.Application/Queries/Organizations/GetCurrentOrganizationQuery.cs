using MediatR;
using StackSift.Application.DTOs;

namespace StackSift.Application.Queries.Organizations;

public record GetCurrentOrganizationQuery : IRequest<OrganizationDto>;

public sealed class GetCurrentOrganizationQueryHandler(
    IUnitOfWork uow,
    ICurrentUserService currentUser)
    : IRequestHandler<GetCurrentOrganizationQuery, OrganizationDto>
{
    public async Task<OrganizationDto> Handle(GetCurrentOrganizationQuery request, CancellationToken ct)
    {
        var org = await uow.Organizations.GetByIdAsync(currentUser.OrganizationId, ct)
            ?? throw new NotFoundException(nameof(Organization), currentUser.OrganizationId);

        return org.ToDto();
    }
}
