using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging;
using StackSift.Domain.Exceptions;
using StackSift.Domain.Interfaces;
using StackSift.Domain.Interfaces.Repositories;

namespace StackSift.Infrastructure.SignalR;

[Authorize]
public sealed class AlertHub(
    ICurrentUserService currentUser,
    IProjectRepository projects,
    ILogger<AlertHub> logger)
    : Hub<IAlertHubClient>
{
    public async Task JoinProjectGroup(string projectId)
    {
        if (!Guid.TryParse(projectId, out var projectGuid))
            throw new HubException("Invalid projectId");

        // Cross-tenant guard: the org-scoped repo returns null (or throws
        // NotFoundException) when the project is not in the caller's org.
        Domain.Entities.Project? project;
        try
        {
            project = await projects.GetByIdAsync(projectGuid, Context.ConnectionAborted);
        }
        catch (NotFoundException)
        {
            project = null;
        }

        if (project is null)
        {
            logger.LogWarning(
                "Cross-tenant JoinProjectGroup blocked. User {UserId} org {OrgId} attempted {ProjectId}",
                currentUser.UserId, currentUser.OrganizationId, projectGuid);

            throw new HubException("Forbidden");
        }

        await Groups.AddToGroupAsync(
            Context.ConnectionId, $"project-{projectGuid}", Context.ConnectionAborted);
    }

    public Task LeaveProjectGroup(string projectId) =>
        Guid.TryParse(projectId, out var projectGuid)
            ? Groups.RemoveFromGroupAsync(Context.ConnectionId, $"project-{projectGuid}", Context.ConnectionAborted)
            : Task.CompletedTask;

    public override async Task OnConnectedAsync()
    {
        // Reject connections with no org claim (pre-onboarding users): they can
        // join no group, so they would only hold an idle connection.
        if (currentUser.OrganizationId == Guid.Empty)
        {
            logger.LogInformation(
                "AlertHub rejecting connection from user {UserId} with no org claim", currentUser.UserId);
            Context.Abort();
            return;
        }

        logger.LogInformation("AlertHub Connected. ConnectionId={ConnectionId} User={UserId} Org={OrgId}",
                                Context.ConnectionId, currentUser.UserId, currentUser.OrganizationId);

        // The only group names this hub joins are derived server-side from the
        // caller's own claim / a post-check project id — never a client string.
        await Groups.AddToGroupAsync(
            Context.ConnectionId, $"org-{currentUser.OrganizationId}", Context.ConnectionAborted);

        await base.OnConnectedAsync();
    }

    public override Task OnDisconnectedAsync(Exception? exception)
    {
        logger.LogInformation("AlertHub Disconnected. ConnectionId={ConnectionId} Reason={Reason}",
                                Context.ConnectionId, exception?.Message ?? "clean");
        return base.OnDisconnectedAsync(exception);
    }
}