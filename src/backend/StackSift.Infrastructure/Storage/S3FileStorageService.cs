using Amazon.S3;
using Amazon.S3.Model;
using Amazon.S3.Transfer;
using Microsoft.Extensions.Options;
using StackSift.Domain.Interfaces;
using StackSift.Domain.ValueObjects;

namespace StackSift.Infrastructure.Storage;

public sealed class S3FileStorageService(IAmazonS3 s3Client, IOptions<S3StorageOptions> opts) : IFileStorageService
{
    private readonly S3StorageOptions _opts = opts.Value;

    public async Task<FileUploadResult> UploadAsync(
        Stream stream,
        string fileName,
        string contentType,
        IDictionary<string, string>? metadata,
        CancellationToken ct)
    {
        var objectKey = BuildObjectKey(fileName, metadata);

        var request = new TransferUtilityUploadRequest
        {
            BucketName = _opts.BucketName,
            Key = objectKey,
            InputStream = stream,
            ContentType = contentType,
            AutoCloseStream = false,
            AutoResetStreamPosition = false,
        };

        if (metadata is not null)
        {
            foreach (var (k, v) in metadata)
                request.Metadata[k] = v;
        }

        // TransferUtility does not take ownership of s3Client when constructed with an existing instance.
        using var transfer = new TransferUtility(s3Client);
        await transfer.UploadAsync(request, ct);

        var meta = await s3Client.GetObjectMetadataAsync(_opts.BucketName, objectKey, ct);
        var presignedUrl = await GetPresignedDownloadUrlAsync(objectKey, TimeSpan.FromMinutes(60), ct);

        return new FileUploadResult(objectKey, meta.ContentLength, contentType, presignedUrl);
    }

    public Task<string> GetPresignedDownloadUrlAsync(string objectKey, TimeSpan ttl, CancellationToken ct)
    {
        var request = new GetPreSignedUrlRequest
        {
            BucketName = _opts.BucketName,
            Key = objectKey,
            Expires = DateTime.UtcNow.Add(ttl),
            Verb = HttpVerb.GET,
        };

        var url = s3Client.GetPreSignedURL(request);

        // Rewrite the internal Docker hostname to the public-facing URL so the
        // presigned link is accessible from a browser outside the Docker network.
        if (!string.IsNullOrEmpty(_opts.PublicEndpoint)
            && !_opts.PublicEndpoint.Equals(_opts.Endpoint, StringComparison.OrdinalIgnoreCase))
        {
            url = url.Replace(_opts.Endpoint, _opts.PublicEndpoint, StringComparison.OrdinalIgnoreCase);
        }

        return Task.FromResult(url);
    }

    public async Task DeleteAsync(string objectKey, CancellationToken ct) =>
        await s3Client.DeleteObjectAsync(_opts.BucketName, objectKey, ct);

    private static string BuildObjectKey(string fileName, IDictionary<string, string>? metadata)
    {
        var orgId = metadata is not null && metadata.TryGetValue("organization-id", out var o) ? o : "unknown";
        var projectId = metadata is not null && metadata.TryGetValue("project-id", out var p) ? p : "unknown";
        var date = DateTime.UtcNow.ToString("yyyy/MM/dd");
        var guid = Guid.NewGuid().ToString("N");
        var safeName = Path.GetFileName(fileName);
        return $"{orgId}/{projectId}/{date}/{guid}_{safeName}";
    }
}
