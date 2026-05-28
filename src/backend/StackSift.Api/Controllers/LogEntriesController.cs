using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using StackSift.Application.Commands.Logs;
using StackSift.Application.Common;
using StackSift.Application.DTOs;
using StackSift.Application.Queries.Logs;
using StackSift.Domain.Enums;
using StackSift.Domain.ValueObjects;
using LogLevel = StackSift.Domain.Enums.LogLevel;

namespace StackSift.Api.Controllers;

/// <summary>Query log entries and ingest log batches.</summary>
[Route("api/v1/logs")]
public class LogEntriesController(MediatR.IMediator mediator) : BaseApiController(mediator)
{
    /// <summary>Search log entries with optional filters and cursor pagination.</summary>
    /// <remarks>
    /// Uses opaque cursor pagination — pass the <c>nextCursor</c> from the previous response
    /// verbatim into the next request. Filters compose with AND
    /// (e.g. <c>level=Error&amp;projectId=...&amp;search=timeout</c>). Without
    /// <paramref name="startDate"/>/<paramref name="endDate"/>, the default window is the last 24h.
    /// </remarks>
    /// <param name="projectId">Filter by project.</param>
    /// <param name="levels">Filter by one or more log levels. Repeat the query key (<c>?levels=Error&amp;levels=Warning</c>).</param>
    /// <param name="search">Full-text search on message.</param>
    /// <param name="startDate">Earliest timestamp (ISO 8601).</param>
    /// <param name="endDate">Latest timestamp (ISO 8601).</param>
    /// <param name="logSourceId">Filter by log source.</param>
    /// <param name="cursor">Opaque cursor from previous response.</param>
    /// <param name="limit">Max results (default 50, max 200).</param>
    /// <returns>Cursor-paginated list of log entries.</returns>
    /// <response code="200">Page of matching log entries with a <c>nextCursor</c> if more pages exist.</response>
    [HttpGet]
    [ProducesResponseType(typeof(CursorPaginatedResponse<LogEntryDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetLogs(
        [FromQuery] Guid? projectId,
        [FromQuery] LogLevel[]? levels,
        [FromQuery] string? search,
        [FromQuery] DateTimeOffset? startDate,
        [FromQuery] DateTimeOffset? endDate,
        [FromQuery] Guid? logSourceId,
        [FromQuery] string? cursor,
        [FromQuery] int limit = 50,
        CancellationToken ct = default)
    {
        var filters = new LogQueryFilters(projectId, levels, search, startDate, endDate, logSourceId);
        var clampedLimit = Math.Clamp(limit, 1, 200);
        return Ok(await Mediator.Send(new GetLogEntriesQuery(filters, clampedLimit, cursor), ct));
    }

    /// <summary>Get a single log entry by ID.</summary>
    /// <param name="id">Log entry GUID.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>The log entry.</returns>
    /// <response code="200">The log entry.</response>
    /// <response code="404">Log entry not found in the caller's organisation's index.</response>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(LogEntryDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetLogEntry(Guid id, CancellationToken ct)
        => Ok(await Mediator.Send(new GetLogEntryByIdQuery(id), ct));

    /// <summary>Ingest a batch of log entries. Accepts <c>X-Api-Key</c> header as an alternative to JWT.</summary>
    /// <param name="body">Batch containing projectId, logSourceId, and up to 1000 log entries.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>202 Accepted — batch is queued for async processing.</returns>
    /// <response code="202">Batch accepted; processed asynchronously by the LogBatchConsumer.</response>
    /// <response code="400">Validation failure (e.g. batch size &gt; 1000, missing projectId).</response>
    /// <response code="401">Neither a valid JWT nor an active <c>X-Api-Key</c> was provided.</response>
    /// <response code="429">Rate limit exceeded for this API key (100 batches / 60 seconds).</response>
    [HttpPost("ingest")]
    [EnableRateLimiting("LogIngest")]
    [ProducesResponseType(StatusCodes.Status202Accepted)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> IngestLogs([FromBody] IngestLogBatchCommand body, CancellationToken ct)
    {
        await Mediator.Send(body, ct);
        return Accepted();
    }
}