using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using StackSift.Application.Interfaces;
using StackSift.Domain.Entities;
using StackSift.Domain.Enums;
using StackSift.Infrastructure.Persistence;
using StackSift.Tests.Helpers;
using Xunit;

namespace StackSift.Tests.Integration;

[Collection("Integration")]
[TestCaseOrderer(
    "StackSift.Tests.Helpers.AlphabeticalTestCaseOrderer",
    "StackSift.Tests")]
public class RegisterEndpointTests(StackSiftWebApplicationFactory factory) : IAsyncLifetime
{
    private HttpClient _client = null!;

    public async Task InitializeAsync()
    {
        await factory.ResetDatabaseAsync();
        _client = factory.CreateUnauthenticatedClient();
    }

    public Task DisposeAsync()
    {
        _client.Dispose();
        return Task.CompletedTask;
    }

    private static readonly JsonSerializerOptions Json = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        Converters = { new JsonStringEnumConverter(JsonNamingPolicy.CamelCase) },
    };

    private sealed record RegisterBody(string Email, string Password, string DisplayName, bool IsOwner);
    private sealed record RegisterResultBody(
        Guid UserId, string Email, string Role, Guid? OrganizationId, bool AttachedViaInvitation);

    private static RegisterBody NewBody(string email, bool isOwner = false) =>
        new(email, "Passw0rd!234", "Test User", isOwner);

    [Fact]
    public async Task Post_Register_NewEmail_Returns201()
    {
        var email = $"new-{Guid.NewGuid():N}@example.com";

        var resp = await _client.PostAsJsonAsync("/api/v1/auth/register",
            NewBody(email, isOwner: true), Json);

        resp.StatusCode.Should().Be(HttpStatusCode.Created);

        var body = await resp.Content.ReadFromJsonAsync<RegisterResultBody>(Json);
        body.Should().NotBeNull();
        body!.Email.Should().Be(email);
        body.Role.Should().Be("owner");
        body.OrganizationId.Should().BeNull();
        body.AttachedViaInvitation.Should().BeFalse();

        // DB has the user
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var dbUser = await db.Users.SingleAsync(u => u.Id == body.UserId);
        dbUser.Email.Should().Be(email);
        dbUser.Role.Should().Be(UserRole.Owner);

        // Keycloak has the user
        var kc = scope.ServiceProvider.GetRequiredService<IKeycloakAdminClient>();
        var kcUser = await kc.FindUserByEmailAsync(email, default);
        kcUser.Should().NotBeNull();
        kcUser!.Id.Should().Be(body.UserId);
        kcUser.StacksiftRole.Should().Be("owner");
    }

    [Fact]
    public async Task Post_Register_DuplicateEmail_Returns409()
    {
        var email = $"dup-{Guid.NewGuid():N}@example.com";

        var first = await _client.PostAsJsonAsync("/api/v1/auth/register",
            NewBody(email), Json);
        first.StatusCode.Should().Be(HttpStatusCode.Created);

        var second = await _client.PostAsJsonAsync("/api/v1/auth/register",
            NewBody(email), Json);
        second.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task Post_Register_WithPendingInvitation_AutoAttaches()
    {
        var email = $"invited-{Guid.NewGuid():N}@example.com";
        var inviterId = Guid.NewGuid();
        var orgId = KeycloakTestRealmSeeder.OrgAId;
        Guid invitationId;

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            // Inviter user — FK target for Invitation.InvitedByUserId via downstream consumers.
            db.Users.Add(new User
            {
                Id = inviterId,
                Email = $"inviter-{Guid.NewGuid():N}@example.com",
                DisplayName = "Inviter",
                Role = UserRole.Owner,
                OrganizationId = orgId,
            });
            var inv = new Invitation
            {
                Id = Guid.NewGuid(),
                OrganizationId = orgId,
                Email = email,
                Role = UserRole.Admin,
                InvitedByUserId = inviterId,
                ExpiresAt = DateTimeOffset.UtcNow.AddDays(7),
                Token = Guid.NewGuid().ToString("N"),
            };
            db.Invitations.Add(inv);
            invitationId = inv.Id;
            await db.SaveChangesAsync();
        }

        var resp = await _client.PostAsJsonAsync("/api/v1/auth/register",
            NewBody(email, isOwner: true), Json);

        resp.StatusCode.Should().Be(HttpStatusCode.Created);
        var body = await resp.Content.ReadFromJsonAsync<RegisterResultBody>(Json);
        body.Should().NotBeNull();
        body!.Role.Should().Be("admin");
        body.OrganizationId.Should().Be(orgId);
        body.AttachedViaInvitation.Should().BeTrue();

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var dbUser = await db.Users.SingleAsync(u => u.Id == body.UserId);
            dbUser.OrganizationId.Should().Be(orgId);
            dbUser.Role.Should().Be(UserRole.Admin);
            dbUser.InvitedByUserId.Should().Be(inviterId);

            var inv = await db.Invitations.SingleAsync(i => i.Id == invitationId);
            inv.AcceptedAt.Should().NotBeNull();
        }
    }

    [Fact]
    public async Task Z_Post_Register_RateLimit_Returns429_AfterTooManyRequests()
    {
        var seenRateLimit = false;
        HttpResponseMessage? rejected = null;

        for (var i = 0; i < 15; i++)
        {
            var resp = await _client.PostAsJsonAsync("/api/v1/auth/register",
                NewBody($"rl-{Guid.NewGuid():N}@example.com"), Json);

            if (resp.StatusCode == HttpStatusCode.TooManyRequests)
            {
                seenRateLimit = true;
                rejected = resp;
                break;
            }
        }

        seenRateLimit.Should().BeTrue("the fixed-window Register policy permits 5 per IP per 10 min");
        rejected!.Headers.Should().ContainKey("Retry-After");
    }
}
