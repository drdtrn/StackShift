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

        try
        {
            // Cross-tenant guard: repo throws NotFoundException when the
            // project's OrganizationId does not match the caller's claim.
            await projects.GetByIdAsync(projectGuid, Context.ConnectionAborted);
        }
        catch (NotFoundException)
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

    public override Task OnConnectedAsync()
    {
        logger.LogInformation("AlertHub Connected. ConnectionId={ConnectionId} User={UserId} Org={OrgId}",
                                Context.ConnectionId, currentUser.UserId, currentUser.OrganizationId);
        return base.OnConnectedAsync();
    }

    public override Task OnDisconnectedAsync(Exception? exception)
    {
        logger.LogInformation("AlertHub Disconnected. ConnectionId={ConnectionId} Reason={Reason}",
                                Context.ConnectionId, exception?.Message ?? "clean");
        return base.OnDisconnectedAsync(exception);
    }
}