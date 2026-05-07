namespace StackSift.Application.DTOs;

public record FileUploadDto(
    string ObjectKey,
    long Size,
    string ContentType,
    string PresignedDownloadUrl
);
