using Microsoft.Extensions.Logging;
using StackSift.Application.Interfaces;

namespace StackSift.Infrastructure.Identity;

internal sealed class AccountErasureService(
    IKeycloakAdminClient keycloak,
    ILogger<AccountErasureService> log) : IAccountErasureService
{
    public async Task DisableKeycloakUserAsync(Guid keycloakUserId, CancellationToken ct)
    {
        try
        {
            await keycloak.SetUserEnabledAsync(keycloakUserId, false, ct);
        }
        catch (Exception ex)
        {
            log.LogError(ex,
                "AccountErasureService: failed to disable Keycloak user {UserId}.",
                keycloakUserId);
            throw;
        }
    }

    public async Task EnableKeycloakUserAsync(Guid keycloakUserId, CancellationToken ct)
    {
        try
        {
            await keycloak.SetUserEnabledAsync(keycloakUserId, true, ct);
        }
        catch (Exception ex)
        {
            log.LogError(ex,
                "AccountErasureService: failed to enable Keycloak user {UserId}.",
                keycloakUserId);
            throw;
        }
    }

    public async Task DeleteKeycloakUserAsync(Guid keycloakUserId, CancellationToken ct)
    {
        try
        {
            await keycloak.DeleteUserAsync(keycloakUserId, ct);
        }
        catch (Exception ex)
        {
            log.LogError(ex,
                "AccountErasureService: failed to delete Keycloak user {UserId}.",
                keycloakUserId);
            throw;
        }
    }
}
