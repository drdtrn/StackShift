using Microsoft.AspNetCore.Mvc;
using StackSift.Application.DTOs;
using StackSift.Application.Queries.Dashboard;

namespace StackSift.Api.Controllers;

/// <summary>Aggregated statistics for the dashboard.</summary>
public class DashboardController(MediatR.IMediator mediator) : BaseApiController(mediator)
{
    /// <summary>Get dashboard stats: active alert count, today's log count, open incident count.</summary>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>Aggregated stats for the current organisation.</returns>
    /// <response code="200">Aggregated stats — cached for 30s in Redis.</response>
    [HttpGet]
    [ProducesResponseType(typeof(DashboardStatsDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetStats(CancellationToken ct)
        => Ok(await Mediator.Send(new GetDashboardStatsQuery(), ct));
}