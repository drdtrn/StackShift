using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using StackSift.Application.Commands.LogSources;
using StackSift.Application.DTOs;
using StackSift.Application.Queries.LogSources;

namespace StackSift.Api.Controllers;

/// <summary>Manage log sources and their API keys.</summary>
[Route("api/v1/log-sources")]
public class LogSourcesController(MediatR.IMediator mediator) : BaseApiController(mediator)
{
    /// <summary>List all log sources for the current organisation.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(List<LogSourceDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetOrganizationLogSources(CancellationToken ct)
        => Ok(await Mediator.Send(new GetOrganizationLogSourcesQuery(), ct));

    /// <summary>Get a single log source.</summary>
    /// <param name="id">Log source GUID.</param>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(LogSourceDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetLogSource(Guid id, CancellationToken ct)
        => Ok(await Mediator.Send(new GetLogSourceByIdQuery(id), ct));

    /// <summary>Regenerate a log source API key.</summary>
    /// <param name="id">Log source GUID.</param>
    [HttpPost("{id:guid}/regenerate-key")]
    [Authorize(Policy = "AdminOrAbove")]
    [ProducesResponseType(typeof(LogSourceCreatedDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> RegenerateKey(Guid id, CancellationToken ct)
        => Ok(await Mediator.Send(new RegenerateLogSourceKeyCommand(id), ct));

    /// <summary>Soft-delete a log source.</summary>
    /// <param name="id">Log source GUID.</param>
    [HttpDelete("{id:guid}")]
    [Authorize(Policy = "AdminOrAbove")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await Mediator.Send(new DeleteLogSourceCommand(id), ct);
        return NoContent();
    }

    /// <summary>Send a synthetic test event through the ingestion pipeline.</summary>
    /// <param name="id">Log source GUID.</param>
    [HttpPost("{id:guid}/test-ingest")]
    [EnableRateLimiting("LogIngest")]
    [ProducesResponseType(typeof(TestIngestResultDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> TestIngest(Guid id, CancellationToken ct)
        => Ok(await Mediator.Send(new TestIngestLogSourceCommand(id), ct));
}
