namespace StackSift.Application.Interfaces;

public interface IKeycloakAdminClient
{
    Task<Guid> CreateUserAsync(
        string email,
        string password,
        string displayName,
        string stacksiftRole,
        Guid? organizationId,
        CancellationToken ct);

    Task SetUserAttributesAsync(
        Guid keycloakUserId,
        string stacksiftRole,
        Guid? organizationId,
        CancellationToken ct);

    Task DeleteUserAsync(Guid keycloakUserId, CancellationToken ct);

    Task SetUserEnabledAsync(Guid keycloakUserId, bool enabled, CancellationToken ct);

    Task<KeycloakUserSummary?> FindUserByEmailAsync(string email, CancellationToken ct);
}

public sealed record KeycloakUserSummary(
    Guid Id,
    string Email,
    string DisplayName,
    string? StacksiftRole,
    Guid? OrganizationId);
