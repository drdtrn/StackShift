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
public class IncidentsController : BaseApiController
{
    public IncidentsController(MediatR.IMediator mediator) : base(mediator)
    {
    }

    /// <summary>List incidents with optional status filter.</summary>
    /// <param name="page">Page number (default 1).</param>
    /// <param name="pageSize">Items per page (default 20, max 100).</param>
    /// <param name="status">Filter by incident status.</param>
    /// <returns>Paginated list of incidents.</returns>
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

    /// <summary>Update the status of an incident.</summary>
    /// <param name="id">Incident GUID.</param>
    /// <param name="body">New status value.</param>
    /// <returns>The updated incident.</returns>
    [HttpPatch("{id:guid}/status")]
    [ProducesResponseType(typeof(IncidentDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateStatus(Guid id, UpdateIncidentStatusBody body, CancellationToken ct)
        => Ok(await Mediator.Send(new UpdateIncidentStatusCommand(id, body.Status), ct));
    
    /// <summary>Trigger AI root-cause analysis for an incident.</summary>
    /// <param name="id">Incident GUID.</param>
    /// <returns>202 Accepted with the created AiAnalysis record (status:pending).</returns>
    [HttpPost("{id:guid}/analyze")]
    [Authorize(Policy = "MembersOrAbove")]
    [ProducesResponseType(typeof(AiAnalysisDto), StatusCodes.Status202Accepted)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> TriggerAnalysis(Guid id, CancellationToken ct)
    {
        var result = await Mediator.Send(new TriggerAiAnalysisCommand(id), ct);
        return Accepted(result);
    }
}