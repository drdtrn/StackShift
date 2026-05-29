using MediatR;
using StackSift.Application.DTOs;
using StackSift.Application.Interfaces;
using StackSift.Domain.Exceptions;
using StackSift.Domain.Interfaces;

namespace StackSift.Application.Queries.Gdpr;

public sealed record ListAccountExportRequestsQuery(int Limit = 20) : IRequest<IReadOnlyList<AccountExportRequestDto>>;

public sealed class ListAccountExportRequestsQueryHandler(
    IAccountExportContext context,
    ICurrentUserService currentUser)
    : IRequestHandler<ListAccountExportRequestsQuery, IReadOnlyList<AccountExportRequestDto>>
{
    public async Task<IReadOnlyList<AccountExportRequestDto>> Handle(
        ListAccountExportRequestsQuery request, CancellationToken ct)
    {
        if (!currentUser.IsAuthenticated)
            throw new ForbiddenException("Authentication required to view account exports.");

        var clampedLimit = Math.Clamp(request.Limit, 1, 100);
        var rows = await context.ListForUserAsync(currentUser.UserId, clampedLimit, ct);

        return rows.Select(e => new AccountExportRequestDto(
            RequestId: e.Id,
            Status: e.Status,
            RequestedAt: e.RequestedAt,
            CompletedAt: e.CompletedAt,
            ExpiresAt: e.ExpiresAt,
            SignedUrl: e.SignedUrl,
            SizeBytes: e.SizeBytes,
            ManifestSha256: e.ManifestSha256)).ToList();
    }
}
