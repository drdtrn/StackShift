using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace StackSift.Api.Controllers;

/// <summary>Public health probe used by load balancers and uptime monitoring.</summary>
[AllowAnonymous]
[ApiController]
public class HealthController : ControllerBase
{
    /// <summary>Returns the API health status. Public endpoint, no authentication required.</summary>
    /// <returns>Health status with current UTC timestamp.</returns>
    /// <response code="200">Service is healthy.</response>
    /// <response code="429">Rate limit exceeded (30 requests / 60 seconds per IP).</response>
    [HttpGet("api/v1/health")]
    [EnableRateLimiting("HealthCheck")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status429TooManyRequests)]
    public IActionResult Get() => Ok(new { status = "healthy", timestamp = DateTimeOffset.UtcNow });
}