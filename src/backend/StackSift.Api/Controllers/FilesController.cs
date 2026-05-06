using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using StackSift.Application.Commands.Files;
using StackSift.Application.DTOs;

namespace StackSift.Api.Controllers;

/// <summary>File upload and management.</summary>
public class FilesController(MediatR.IMediator mediator) : BaseApiController(mediator)
{
    /// <summary>
    /// Upload a log file (.log, .txt, .yaml, or .yml — max 50 MB) and associate it with a project.
    /// The file is streamed directly to MinIO object storage without buffering into API memory.
    /// </summary>
    /// <param name="file">The log file to upload (multipart/form-data field named "file").</param>
    /// <param name="projectId">The project to associate this file with.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>Upload metadata including a presigned download URL valid for 60 minutes.</returns>
    [HttpPost("upload")]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(52_428_800)]
    [RequestFormLimits(MultipartBodyLengthLimit = 52_428_800)]
    [Authorize(Policy = "MemberOrAbove")]
    [EnableRateLimiting("FileUpload")]
    [ProducesResponseType(typeof(FileUploadDto), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status413PayloadTooLarge)]
    public async Task<IActionResult> Upload(
        [FromForm] IFormFile file,
        [FromForm] Guid projectId,
        CancellationToken ct)
    {
        var dto = await Mediator.Send(new UploadLogFileCommand(file, projectId), ct);
        return Created(dto.PresignedDownloadUrl, dto);
    }
}
