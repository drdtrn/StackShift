using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using StackSift.Application.Commands.Auth;

namespace StackSift.Api.Controllers;

/// <summary>Anonymous authentication endpoints — registration, accept-invitation.</summary>
[ApiController]
[AllowAnonymous]
[Route("api/v1/auth")]
public sealed class AuthController(IMediator mediator) : ControllerBase
{
    private readonly IMediator _mediator = mediator;

    /// <summary>Register a new user. Auto-attaches to an organisation if a pending invitation matches the email.</summary>
    /// <remarks>
    /// The handler creates a Keycloak user (with role + org claims already set), then writes a
    /// matching `Users` row. If a non-expired `Invitation` exists for the submitted email, the
    /// invitation's role and organisation win over the `isOwner` flag from the form.
    /// </remarks>
    /// <param name="cmd">Email, password (≥12 chars + upper + lower + digit), display name, and "are you an owner" flag.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>Created user id, email, role, organisation id (if any), and whether an invitation matched.</returns>
    /// <response code="201">Registration succeeded.</response>
    /// <response code="400">Validation failed.</response>
    /// <response code="403">Registration is invite-only and no pending invitation matches the email.</response>
    /// <response code="409">Email already in use.</response>
    /// <response code="429">Rate limited (5 registrations per IP per 10 min).</response>
    [HttpPost("register")]
    [EnableRateLimiting("Register")]
    [ProducesResponseType(typeof(RegisterUserResult), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> Register([FromBody] RegisterUserCommand cmd, CancellationToken ct)
    {
        // RemoteIp is set server-side from the connection — never trusted from the body.
        var result = await _mediator.Send(
            cmd with { RemoteIp = HttpContext.Connection.RemoteIpAddress?.ToString() }, ct);
        return Created($"/api/v1/users/{result.UserId}", result);
    }

    /// <summary>Accept an invitation by token and create the user account.</summary>
    /// <remarks>
    /// This is the public landing for the email-link path. The invitation's role and
    /// organisation are baked in — the user just chooses a password and display name.
    /// The frontend follows up with `POST /api/auth/login` using the returned email.
    /// </remarks>
    /// <param name="cmd">Token + password + display name.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>Created user id, email, organisation id, and role.</returns>
    /// <response code="200">Invitation accepted; account created.</response>
    /// <response code="400">Validation failed.</response>
    /// <response code="409">Token is unknown, already used, or expired.</response>
    /// <response code="429">Rate limited (shared 5/IP/10 min envelope with /register).</response>
    [HttpPost("accept-invitation")]
    [EnableRateLimiting("Register")]
    [ProducesResponseType(typeof(AcceptInvitationResult), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> AcceptInvitation(
        [FromBody] AcceptInvitationCommand cmd,
        CancellationToken ct)
    {
        var result = await _mediator.Send(cmd, ct);
        return Ok(result);
    }
}
