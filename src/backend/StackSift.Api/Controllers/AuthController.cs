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
    /// <response code="409">Email already in use.</response>
    /// <response code="429">Rate limited (5 registrations per IP per 10 min).</response>
    [HttpPost("register")]
    [EnableRateLimiting("Register")]
    [ProducesResponseType(typeof(RegisterUserResult), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> Register([FromBody] RegisterUserCommand cmd, CancellationToken ct)
    {
        var result = await _mediator.Send(cmd, ct);
        return Created($"/api/v1/users/{result.UserId}", result);
    }
}
