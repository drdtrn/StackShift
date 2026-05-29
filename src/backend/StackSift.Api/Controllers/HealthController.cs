using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace StackSift.Api.Controllers;

/// <summary>Public health probe used by load balancers and uptime monitoring.</summary>
[AllowAnonymous]
[ApiController]
public class HealthController(HealthCheckService healthCheckService) : ControllerBase
{
    /// <summary>Returns the API health status. Public endpoint, no authentication required.</summary>
    /// <returns>Liveness status with current UTC timestamp.</returns>
    /// <response code="200">Service is healthy.</response>
    /// <response code="429">Rate limit exceeded (30 requests / 60 seconds per IP).</response>
    [HttpGet("api/v1/health")]
    [EnableRateLimiting("HealthCheck")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> Get(CancellationToken ct)
        => Ok(new
        {
            status = (await healthCheckService.CheckHealthAsync(
                registration => registration.Tags.Contains("live"),
                ct)).Status.ToString(),
            timestamp = DateTimeOffset.UtcNow,
        });
}
