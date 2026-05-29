using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
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
}
