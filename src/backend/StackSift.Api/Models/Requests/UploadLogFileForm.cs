namespace StackSift.Api.Models.Requests;

/// <summary>Multipart form for <c>POST /api/v1/files/upload</c>.</summary>
/// <param name="File">Log file to upload (.log/.txt/.yaml/.yml, ≤ 50 MB).</param>
/// <param name="ProjectId">Project that owns the file.</param>
public record UploadLogFileForm(IFormFile File, Guid ProjectId);
