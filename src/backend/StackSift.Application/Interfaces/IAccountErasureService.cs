using StackSift.Domain.Entities;

namespace StackSift.Application.Interfaces;

/// <summary>
/// Domain-side operations for the account erasure flow that touch external
/// systems (Keycloak, optionally Stripe). Implemented in Infrastructure.
/// </summary>
public interface IAccountErasureService
{
    /// <summary>Disables the Keycloak user immediately so all subsequent
    /// authentications fail. Idempotent.</summary>
    Task DisableKeycloakUserAsync(Guid keycloakUserId, CancellationToken ct);

    /// <summary>Re-enables a Keycloak user during the grace window restore flow.</summary>
    Task EnableKeycloakUserAsync(Guid keycloakUserId, CancellationToken ct);

    /// <summary>Permanently deletes the Keycloak user. Called by the post-grace
    /// AccountErasureJob.</summary>
    Task DeleteKeycloakUserAsync(Guid keycloakUserId, CancellationToken ct);
}

public interface IAccountErasureJobRunner
{
    Task ExecuteAsync(CancellationToken ct);
}

public interface IErasureCancellationTokenHasher
{
    string Generate();
    string Hash(string token);
}
