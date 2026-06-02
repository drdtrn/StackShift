using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace StackSift.Api.Controllers;

/// <summary>Base controller for all StackSift API endpoints. Applies the default
/// <c>[Authorize]</c> policy, the <c>EmailVerified</c> policy, and the
/// <c>/api/v1/[controller]</c> route prefix, and exposes an <see cref="IMediator"/>
/// instance to derived controllers.</summary>
[Authorize]
[Authorize(Policy = "EmailVerified")]
[ApiController]
[EnableRateLimiting("PerUser")]
[Route("api/v1/[controller]")]
public abstract class BaseApiController(IMediator mediator) : ControllerBase
{
    /// <summary>MediatR sender used by every action to dispatch commands and queries.</summary>
    protected readonly IMediator Mediator = mediator;
}
