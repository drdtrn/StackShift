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
public class LogEntriesController : BaseApiController
{
    public LogEntriesController(MediatR.IMediator mediator) : base(mediator)
    {
    }

    /// <summary>Search log entries with optional filters and cursor pagination.</summary>
    /// <param name="projectId">Filter by project.</param>
    /// <param name="level">Filter by log level.</param>
    /// <param name="search">Full-text search on message.</param>
    /// <param name="startDate">Earliest timestamp (ISO 8601).</param>
    /// <param name="endDate">Latest timestamp (ISO 8601).</param>
    /// <param name="logSourceId">Filter by log source.</param>
    /// <param name="cursor">Opaque cursor from previous response.</param>
    /// <param name="limit">Max results (default 50, max 200).</param>
    /// <returns>Cursor-paginated list of log entries.</returns>
    [HttpGet]
    [ProducesResponseType(typeof(CursorPaginatedResponse<LogEntryDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetLogs(
        [FromQuery] Guid? projectId,
        [FromQuery] LogLevel? level,
        [FromQuery] string? search,
        [FromQuery] DateTimeOffset? startDate,
        [FromQuery] DateTimeOffset? endDate,
        [FromQuery] Guid? logSourceId,
        [FromQuery] string? cursor,
        [FromQuery] int limit = 50,
        CancellationToken ct = default)
    {
        var filters = new LogQueryFilters(projectId, level, search, startDate, endDate, logSourceId);
        var clampedLimit = Math.Clamp(limit, 1, 200);
        return Ok(await Mediator.Send(new GetLogEntriesQuery(filters, clampedLimit, cursor), ct));
    }

    /// <summary>Ingest a batch of log entries. Accepts X-Api-Key header as an alternative to JWT.</summary>
    /// <param name="body">Batch containing projectId, logSourceId, and up to 1000 log entries.</param>
    /// <returns>202 Accepted — batch is queued for async processing.</returns>
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