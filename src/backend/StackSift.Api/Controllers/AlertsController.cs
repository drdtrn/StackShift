using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StackSift.Application.Commands.Alerts;
using StackSift.Application.Common;
using StackSift.Application.DTOs;
using StackSift.Application.Queries.Alerts;

namespace StackSift.Api.Controllers;

/// <summary>View and acknowledge alerts.</summary>
public class AlertsController(MediatR.IMediator mediator) : BaseApiController(mediator)
{
    /// <summary>List alerts, optionally filtered by project.</summary>
    /// <param name="page">Page number (default 1).</param>
    /// <param name="pageSize">Items per page (default 20, max 100).</param>
    /// <param name="projectId">Optional project filter.</param>
    /// <returns>Paginated list of alerts.</returns>
    [HttpGet]
    [ProducesResponseType(typeof(PaginatedResponse<AlertDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetAlerts(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] Guid? projectId = null,
        CancellationToken ct = default)
        => Ok(await Mediator.Send(new GetAlertsQuery(page, Math.Min(pageSize, 100), projectId), ct));

    /// <summary>Get a single alert by ID.</summary>
    /// <param name="id">Alert GUID.</param>
    /// <returns>The alert.</returns>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(AlertDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetAlert(Guid id, CancellationToken ct)
        => Ok(await Mediator.Send(new GetAlertByIdQuery(id), ct));

    /// <summary>Acknowledge an alert, setting <c>AcknowledgedAt</c> to now.</summary>
    /// <param name="id">Alert GUID.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>The updated alert.</returns>
    /// <response code="200">Alert acknowledged. Returns the updated alert.</response>
    /// <response code="400">Alert is already acknowledged or in a non-acknowledgeable state.</response>
    /// <response code="404">Alert not found in the caller's organisation.</response>
    [HttpPatch("{id:guid}/acknowledge")]
    [Authorize(Policy = "MemberOrAbove")]
    [ProducesResponseType(typeof(AlertDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> AcknowledgeAlert(Guid id, CancellationToken ct)
        => Ok(await Mediator.Send(new AcknowledgeAlertCommand(id), ct));
}