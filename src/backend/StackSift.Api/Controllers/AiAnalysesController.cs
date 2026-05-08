using Microsoft.AspNetCore.Mvc;
using StackSift.Application.DTOs;
using StackSift.Application.Queries.AiAnalyses;

namespace StackSift.Api.Controllers;

/// <summary>Read-side access to AI analyses. Triggering an analysis lives at
/// <c>POST /api/v1/incidents/{id}/analyze</c>.</summary>
[Route("api/v1/ai-analyses")]
public class AiAnalysesController : BaseApiController
{
    public AiAnalysesController(MediatR.IMediator mediator) : base(mediator) { }

    /// <summary>Get an AI analysis by ID.</summary>
    /// <param name="id">AI analysis GUID.</param>
    /// <returns>The analysis with its current status and (when completed) summary, root cause,
    /// suggested fixes, and confidence score. Frontend uses this as a polling fallback when
    /// SignalR is mocked or disconnected.</returns>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(AiAnalysisDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
        => Ok(await Mediator.Send(new GetAiAnalysisByIdQuery(id), ct));
}
