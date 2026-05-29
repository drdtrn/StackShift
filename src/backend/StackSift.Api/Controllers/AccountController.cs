using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StackSift.Api.Models.Requests;
using StackSift.Application.Commands.Gdpr;
using StackSift.Application.DTOs;
using StackSift.Application.Queries.Gdpr;

namespace StackSift.Api.Controllers;

/// <summary>GDPR-facing account endpoints: data export (Article 15) and
/// erasure (Article 17). All endpoints require an authenticated user.</summary>
[ApiController]
[Route("api/v1/account")]
[Authorize]
public sealed class AccountController(IMediator mediator) : ControllerBase
{
    private readonly IMediator _mediator = mediator;

    /// <summary>List the calling user's past data export requests.</summary>
    /// <remarks>Returns up to <paramref name="limit"/> rows ordered by most-recent
    /// request first. Pending and Ready states include their object key and
    /// signed URL respectively; Failed entries include a short failure reason.</remarks>
    [HttpGet("export-requests")]
    [ProducesResponseType(typeof(IReadOnlyList<AccountExportRequestDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> ListExportRequests(
        [FromQuery] int limit = 20,
        CancellationToken ct = default)
    {
        var rows = await _mediator.Send(new ListAccountExportRequestsQuery(limit), ct);
        return Ok(rows);
    }

    /// <summary>Request a GDPR Article 15 data export of every record StackSift
    /// holds about the calling user.</summary>
    /// <remarks>Idempotent: while a pending request exists for the user, returns
    /// the existing request. Rate limited to one completed export per 7 days —
    /// over the window the endpoint returns 409 with the next-available
    /// timestamp.</remarks>
    [HttpPost("export-requests")]
    [ProducesResponseType(typeof(AccountExportRequestDto), StatusCodes.Status202Accepted)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> RequestExport(CancellationToken ct)
    {
        var dto = await _mediator.Send(new RequestAccountExportCommand(), ct);
        return AcceptedAtAction(nameof(ListExportRequests), new { }, dto);
    }

    /// <summary>Request GDPR Article 17 erasure of the calling user's account.</summary>
    /// <remarks>The user is soft-deleted immediately and the Keycloak user is
    /// disabled. A single-use cancellation token is returned — the caller is
    /// expected to email it to themselves (or surface it in the UI) so they
    /// have the option to restore the account during the 30-day grace window.
    /// Hard deletion runs nightly via AccountErasureJob.</remarks>
    [HttpDelete]
    [ProducesResponseType(typeof(AccountDeletionAcceptedDto), StatusCodes.Status202Accepted)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> DeleteAccount(
        [FromBody] DeleteAccountRequest body,
        CancellationToken ct)
    {
        var dto = await _mediator.Send(new RequestAccountDeletionCommand(body.Confirmation), ct);
        return Accepted(dto);
    }

    /// <summary>Cancel a pending account deletion using the token mailed at request time.</summary>
    /// <remarks>Anonymous endpoint — the token is the only auth. Single-use:
    /// burned on success so a stolen-after-restore token cannot re-cancel.</remarks>
    [HttpPost("restore")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(CancelAccountDeletionResultDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> RestoreAccount(
        [FromBody] RestoreAccountRequest body,
        CancellationToken ct)
    {
        var dto = await _mediator.Send(new CancelAccountDeletionCommand(body.Token), ct);
        return Ok(dto);
    }
}
