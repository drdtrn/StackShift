using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using StackSift.Api.Models.Requests;
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
    /// <remarks>
    /// Rate-limited to 20 uploads/minute per organisation. Files are stored with the key
    /// <c>{organizationId}/{projectId}/{yyyy/MM/dd}/{guid}_{originalFileName}</c>; the
    /// <c>Location</c> response header carries the presigned URL (valid for 60 minutes).
    /// </remarks>
    /// <param name="form">Multipart form: the file plus the destination project ID.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>Upload metadata including a presigned download URL valid for 60 minutes.</returns>
    /// <response code="201">File uploaded. <c>Location</c> header carries a presigned download URL.</response>
    /// <response code="400">Validation failure — wrong extension, wrong content-type, empty file, or wrong project.</response>
    /// <response code="413">File exceeds the 50 MB cap.</response>
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
    public async Task<IActionResult> Upload([FromForm] UploadLogFileForm form, CancellationToken ct)
    {
        var dto = await Mediator.Send(new UploadLogFileCommand(form.File, form.ProjectId), ct);
        return Created(dto.PresignedDownloadUrl, dto);
    }
}
