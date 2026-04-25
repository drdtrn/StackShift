using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StackSift.Api.Models.Requests;
using StackSift.Application.Commands.AlertRules;
using StackSift.Application.DTOs;
using StackSift.Application.Queries.AlertRules;

namespace StackSift.Api.Controllers;

/// <summary>Manage alert rules for a project.</summary>
[Route("api/v1/alert-rules")]
public class AlertRulesController : BaseApiController
{
    public AlertRulesController(MediatR.IMediator mediator) : base(mediator)
    {
    }

    /// <summary>List alert rules for a project.</summary>
    /// <param name="projectId">Project GUID (required).</param>
    /// <returns>All active alert rules for the project.</returns>
    [HttpGet]
    [ProducesResponseType(typeof(List<AlertRuleDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetAlertRules([FromQuery] Guid projectId, CancellationToken ct)
        => Ok(await Mediator.Send(new GetAlertRulesQuery(projectId), ct));

    /// <summary>Create a new alert rule.</summary>
    /// <param name="body">Alert rule definition.</param>
    /// <returns>The created alert rule.</returns>
    [HttpPost]
    [Authorize(Policy = "MemberOrAbove")]
    [ProducesResponseType(typeof(AlertRuleDto), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> CreateAlertRule([FromBody] CreateAlertRuleCommand body, CancellationToken ct)
    {
        var result = await Mediator.Send(body, ct);
        return CreatedAtAction(nameof(GetAlertRules), new { projectId = result.ProjectId }, result);
    }

    /// <summary>Update an existing alert rule.</summary>
    /// <param name="id">Alert rule GUID.</param>
    /// <param name="body">Updated alert rule fields.</param>
    /// <returns>The updated alert rule.</returns>
    [HttpPut("{id:guid}")]
    [Authorize(Policy = "MemberOrAbove")]
    [ProducesResponseType(typeof(AlertRuleDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateAlertRule(Guid id, [FromBody] UpdateAlertRuleBody body, CancellationToken ct)
        => Ok(await Mediator.Send(
            new UpdateAlertRuleCommand(
                id,
                body.Name,
                body.Condition,
                body.Threshold,
                body.WindowMinutes,
                body.LogLevel,
                body.Pattern,
                body.IsActive),
            ct));
    
    /// <summary>Delete an alert rule.</summary>
    /// <param name="id">Alert rule GUID.</param>
    [HttpDelete("{id:guid}")]
    [Authorize(Policy = "AdminOrAbove")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteAlertRule(Guid id, CancellationToken ct)
    {
        await Mediator.Send(new DeleteAlertRuleCommand(id), ct);
        return NoContent();
    }
}