using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace StackSift.Api.Controllers;

[AllowAnonymous]
[ApiController]
public class HealthController : ControllerBase
{
    /// <summary>Returns the API health status. Public endpoint, no authentication required.</summary>
    /// <returns>Health status with current UTC timestamp.</returns>
    [HttpGet("api/v1/health")]
    [EnableRateLimiting("HealthCheck")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status429TooManyRequests)]
    public IActionResult Get() => Ok(new { status = "healthy", timestamp = DateTimeOffset.UtcNow });
}