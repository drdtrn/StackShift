using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StackSift.Api.Models.Requests;
using StackSift.Application.Commands.Members;
using StackSift.Application.DTOs;
using StackSift.Application.Queries.Members;

namespace StackSift.Api.Controllers;

/// <summary>Members of an organisation — list, add-by-email (unified attach/invite), role change, remove.</summary>
[ApiController]
[Route("api/v1/organizations/{orgId:guid}/members")]
[Authorize(Policy = "MemberOrAbove")]
public sealed class MembersController(IMediator mediator) : ControllerBase
{
    private readonly IMediator _mediator = mediator;

    /// <summary>List members of the given organisation.</summary>
    /// <response code="200">All members in the organisation.</response>
    /// <response code="401">No session cookie.</response>
    /// <response code="403">Caller lacks the MemberOrAbove role.</response>
    /// <response code="404">Cross-tenant — caller's org doesn't match the route org.</response>
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<MemberDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> List(Guid orgId, CancellationToken ct)
        => Ok(await _mediator.Send(new GetMembersQuery(orgId), ct));

    /// <summary>Add an existing user or send an invitation to a not-yet-registered email.</summary>
    /// <remarks>
    /// 201 with a `Member` payload when the email maps to an existing waiting user (they're
    /// attached immediately). 202 with an `Invitation` payload when the email is unknown — an
    /// `Invitation` row is created and an invite email is sent.
    /// </remarks>
    /// <response code="201">Existing user attached.</response>
    /// <response code="202">Invitation row created + email sent.</response>
    /// <response code="400">Validation failed.</response>
    /// <response code="403">Caller is not the owner.</response>
    /// <response code="404">Cross-tenant.</response>
    /// <response code="409">Email already belongs to a member of this org or another org.</response>
    [HttpPost]
    [Authorize(Policy = "OwnerOnly")]
    [ProducesResponseType(typeof(AddOrInviteMemberResult), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(AddOrInviteMemberResult), StatusCodes.Status202Accepted)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> AddOrInvite(
        Guid orgId,
        [FromBody] AddOrInviteMemberBody body,
        CancellationToken ct)
    {
        var result = await _mediator.Send(
            new AddOrInviteMemberCommand(orgId, body.Email, body.Role), ct);

        if (result.Member is not null)
            return Created(
                $"/api/v1/organizations/{orgId}/members/{result.Member.Id}",
                result);
        return Accepted(result);
    }

    /// <summary>Change a member's role.</summary>
    /// <response code="200">Updated member.</response>
    /// <response code="403">Caller is not the owner.</response>
    /// <response code="404">Cross-tenant or unknown user.</response>
    /// <response code="409">Demoting the last owner is blocked.</response>
    [HttpPatch("{userId:guid}")]
    [Authorize(Policy = "OwnerOnly")]
    [ProducesResponseType(typeof(MemberDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> UpdateRole(
        Guid orgId,
        Guid userId,
        [FromBody] UpdateMemberRoleBody body,
        CancellationToken ct)
        => Ok(await _mediator.Send(new UpdateMemberRoleCommand(orgId, userId, body.Role), ct));

    /// <summary>Remove a member from the organisation. The account itself is preserved.</summary>
    /// <response code="204">Removed.</response>
    /// <response code="403">Caller is not the owner.</response>
    /// <response code="404">Cross-tenant or unknown user.</response>
    /// <response code="409">Removing the last owner is blocked.</response>
    [HttpDelete("{userId:guid}")]
    [Authorize(Policy = "OwnerOnly")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Remove(Guid orgId, Guid userId, CancellationToken ct)
    {
        await _mediator.Send(new RemoveMemberCommand(orgId, userId), ct);
        return NoContent();
    }
}
