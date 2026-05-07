namespace StackSift.Domain.ValueObjects;

public record FileUploadResult(
    string ObjectKey,
    long Size,
    string ContentType,
    string PresignedDownloadUrl
);
