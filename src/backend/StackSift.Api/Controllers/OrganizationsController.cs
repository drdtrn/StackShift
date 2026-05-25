using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StackSift.Api.Models.Requests;
using StackSift.Application.Commands.Organizations;
using StackSift.Application.DTOs;

namespace StackSift.Api.Controllers;

/// <summary>Organisations — the tenant boundary for every other resource.</summary>
[ApiController]
[Route("api/v1/organizations")]
[Authorize]
public sealed class OrganizationsController(IMediator mediator) : ControllerBase
{
    private readonly IMediator _mediator = mediator;

    /// <summary>Create the calling user's first organisation.</summary>
    /// <remarks>
    /// Available to any authenticated user without an organisation. The caller is
    /// promoted to <c>Owner</c> of the new organisation, the matching
    /// <c>organization_id</c> attribute is set on the Keycloak user so the next
    /// silent refresh issues a JWT with the new claim, and a single
    /// <c>Organization</c> row is returned.
    /// </remarks>
    /// <param name="body">Display name (2–50 chars).</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>The new organisation.</returns>
    /// <response code="201">Created.</response>
    /// <response code="400">Validation failed.</response>
    /// <response code="401">No session cookie.</response>
    /// <response code="409">Caller already belongs to an organisation, or the derived slug already exists.</response>
    [HttpPost]
    [ProducesResponseType(typeof(OrganizationDto), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Create(
        [FromBody] CreateOrganizationBody body,
        CancellationToken ct)
    {
        var result = await _mediator.Send(new CreateOrganizationCommand(body.Name), ct);
        return Created($"/api/v1/organizations/{result.Id}", result);
    }
}
