using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace StackSift.Api.Controllers;

/// <summary>File upload and management.</summary>
public class FilesController : BaseApiController
{
    public FilesController(MediatR.IMediator mediator) : base(mediator) { }

    /// <summary>Upload a log file (.log, .txt, .yaml, max 50 MB). Full implementation in BE-15.</summary>
    /// <returns>501 Not Implemented until BE-15 is complete.</returns>
    [HttpPost("upload")]
    [Authorize(Policy = "MemberOrAbove")]
    [ProducesResponseType(StatusCodes.Status501NotImplemented)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    public IActionResult Upload()
        => StatusCode(StatusCodes.Status501NotImplemented);
}