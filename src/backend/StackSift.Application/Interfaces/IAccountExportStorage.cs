namespace StackSift.Application.Interfaces;

public interface IAccountExportStorage
{
    Task<AccountExportUploadResult> UploadAsync(
        Guid userId,
        Guid requestId,
        Stream content,
        CancellationToken ct);

    Task<string> GeneratePresignedUrlAsync(
        string objectKey,
        TimeSpan ttl,
        CancellationToken ct);
}

public sealed record AccountExportUploadResult(
    string ObjectKey,
    long SizeBytes,
    string Sha256Hex);
