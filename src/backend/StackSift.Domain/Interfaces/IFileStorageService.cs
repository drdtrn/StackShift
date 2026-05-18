using StackSift.Domain.ValueObjects;

namespace StackSift.Domain.Interfaces;

public interface IFileStorageService
{
    Task<FileUploadResult> UploadAsync(
        Stream stream,
        string fileName,
        string contentType,
        IDictionary<string, string>? metadata,
        CancellationToken ct);

    Task<string> GetPresignedDownloadUrlAsync(string objectKey, TimeSpan ttl, CancellationToken ct);

    Task DeleteAsync(string objectKey, CancellationToken ct);
}
