using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StackSift.Api.Models.Requests;
using StackSift.Application.Commands.AiAnalyses;
using StackSift.Application.Commands.Incidents;
using StackSift.Application.Common;
using StackSift.Application.DTOs;
using StackSift.Application.Queries.Incidents;
using StackSift.Domain.Enums;

namespace StackSift.Api.Controllers;

/// <summary>View and manage incidents.</summary>
public class IncidentsController(MediatR.IMediator mediator) : BaseApiController(mediator)
{
    /// <summary>List incidents with optional status filter.</summary>
    /// <param name="page">Page number (default 1).</param>
    /// <param name="pageSize">Items per page (default 20, max 100).</param>
    /// <param name="status">Filter by incident status.</param>
    /// <param name="projectId">Optional project filter (defaults to all projects in the org).</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>Paginated list of incidents.</returns>
    /// <response code="200">Page of matching incidents.</response>
    [HttpGet]
    [ProducesResponseType(typeof(PaginatedResponse<IncidentDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetIncidents(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] IncidentStatus? status = null,
        [FromQuery] Guid? projectId = null,
        CancellationToken ct = default)
        => Ok(await Mediator.Send(new GetIncidentsQuery(page, Math.Min(pageSize, 100), status, projectId), ct));

    /// <summary>Get a single incident by ID.</summary>
    /// <param name="id">Incident GUID.</param>
    /// <returns>The incident.</returns>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(IncidentDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetIncident(Guid id, CancellationToken ct)
        => Ok(await Mediator.Send(new GetIncidentByIdQuery(id), ct));

    /// <summary>Update the status of an incident (Open → Acknowledged → Resolved).</summary>
    /// <param name="id">Incident GUID.</param>
    /// <param name="body">New status value. Allowed transitions: Open→Acknowledged, Acknowledged→Resolved, Open→Resolved. Resolved→Open is rejected.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>The updated incident.</returns>
    /// <response code="200">Status updated.</response>
    /// <response code="400">Invalid state transition (e.g. Resolved → Open).</response>
    /// <response code="404">Incident not found in the caller's organisation.</response>
    [HttpPatch("{id:guid}/status")]
    [ProducesResponseType(typeof(IncidentDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateStatus(Guid id, [FromBody] UpdateIncidentStatusBody body, CancellationToken ct)
        => Ok(await Mediator.Send(new UpdateIncidentStatusCommand(id, body.Status), ct));
    
    /// <summary>Trigger AI root-cause analysis for an incident.</summary>
    /// <remarks>
    /// Returns 202 immediately; the analysis runs in a Hangfire background job. Frontends
    /// either subscribe to the SignalR <c>ReceiveAiAnalysisCompleted</c> push or poll
    /// <c>GET /api/v1/ai-analyses/{id}</c> using the ID from the response body until
    /// <c>status</c> is <c>completed</c> or <c>failed</c>.
    /// </remarks>
    /// <param name="id">Incident GUID.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>202 Accepted with the created AiAnalysis record (status:pending).</returns>
    /// <response code="202">Analysis queued. The <c>Location</c> header points at the polling endpoint.</response>
    /// <response code="404">Incident not found in the caller's organisation.</response>
    [HttpPost("{id:guid}/analyze")]
    [Authorize(Policy = "MemberOrAbove")]
    [ProducesResponseType(typeof(AiAnalysisDto), StatusCodes.Status202Accepted)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> TriggerAnalysis(Guid id, CancellationToken ct)
    {
        var result = await Mediator.Send(new TriggerAiAnalysisCommand(id), ct);
        return Accepted(
            Url.Action(
                controller: "AiAnalyses",
                action: nameof(AiAnalysesController.GetById),
                values: new { id = result.Id }),
            result);
    }
}