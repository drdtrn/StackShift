using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using StackSift.Domain.Entities;
using StackSift.Domain.Interfaces.Repositories;
using StackSift.Infrastructure.SignalR;
using StackSift.Tests.Helpers;
using Xunit;

namespace StackSift.Tests.Infrastructure.SignalR;

public sealed class AlertHubTests
{
    private readonly Mock<IProjectRepository> _projects = new();
    private readonly Mock<IGroupManager> _groups = new();
    private readonly Mock<HubCallerContext> _context = new();

    public AlertHubTests()
    {
        _context.SetupGet(c => c.ConnectionId).Returns("conn-1");
        _context.SetupGet(c => c.ConnectionAborted).Returns(CancellationToken.None);
    }

    [Fact]
    public async Task OnConnected_with_no_org_claim_aborts_and_joins_no_group()
    {
        var hub = NewHub(orgId: Guid.Empty);

        await hub.OnConnectedAsync();

        _context.Verify(c => c.Abort(), Times.Once);
        _groups.Verify(
            g => g.AddToGroupAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task OnConnected_with_org_joins_the_org_group()
    {
        var orgId = Guid.NewGuid();
        var hub = NewHub(orgId);

        await hub.OnConnectedAsync();

        _context.Verify(c => c.Abort(), Times.Never);
        _groups.Verify(
            g => g.AddToGroupAsync("conn-1", $"org-{orgId}", It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task JoinProjectGroup_for_foreign_project_throws_HubException()
    {
        var hub = NewHub(Guid.NewGuid());
        // The org-scoped repo returns null for another tenant's project.
        _projects.Setup(p => p.GetByIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((Project?)null);

        await Assert.ThrowsAsync<HubException>(() => hub.JoinProjectGroup(Guid.NewGuid().ToString()));

        _groups.Verify(
            g => g.AddToGroupAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task JoinProjectGroup_for_own_project_joins_group()
    {
        var hub = NewHub(Guid.NewGuid());
        var projectId = Guid.NewGuid();
        _projects.Setup(p => p.GetByIdAsync(projectId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Project { Id = projectId });

        await hub.JoinProjectGroup(projectId.ToString());

        _groups.Verify(
            g => g.AddToGroupAsync("conn-1", $"project-{projectId}", It.IsAny<CancellationToken>()),
            Times.Once);
    }

    private AlertHub NewHub(Guid orgId)
    {
        var currentUser = new FakeCurrentUserService { OrganizationId = orgId, UserId = Guid.NewGuid() };
        return new AlertHub(currentUser, _projects.Object, NullLogger<AlertHub>.Instance)
        {
            Context = _context.Object,
            Groups = _groups.Object,
        };
    }
}
