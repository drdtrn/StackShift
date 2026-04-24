using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace StackSift.Api.Controllers;

[AllowAnonymous]
public class HealthController : ControllerBase
{
    [HttpGet("api/v1/health")]
    public IActionResult Get() => Ok(new { status = "healthy", timestamp = DateTime.UtcNow });
}