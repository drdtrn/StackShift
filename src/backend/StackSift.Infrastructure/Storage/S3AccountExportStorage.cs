using System.Security.Cryptography;
using Amazon.S3;
using Amazon.S3.Model;
using Microsoft.Extensions.Options;
using StackSift.Application.Interfaces;

namespace StackSift.Infrastructure.Storage;

public sealed class S3AccountExportStorage(
    IAmazonS3 s3,
    IOptions<S3StorageOptions> opts) : IAccountExportStorage
{
    private readonly S3StorageOptions _opts = opts.Value;

    public async Task<AccountExportUploadResult> UploadAsync(
        Guid userId,
        Guid requestId,
        Stream content,
        CancellationToken ct)
    {
        var objectKey = $"{userId}/{requestId}.zip";

        // The caller streams a non-seekable MemoryStream; compute SHA-256
        // while copying into a fresh buffer so we can both hash and upload
        // without rewinding the source. Small enough to keep in memory in
        // the v1 (capped via the BuildAccountExportJob's row limits); a
        // future streaming variant will hash incrementally during multipart
        // upload.
        await using var buffer = new MemoryStream();
        await content.CopyToAsync(buffer, ct);
        buffer.Position = 0;
        var hashBytes = await SHA256.HashDataAsync(buffer, ct);
        buffer.Position = 0;

        var put = new PutObjectRequest
        {
            BucketName = _opts.ExportBucketName,
            Key = objectKey,
            InputStream = buffer,
            ContentType = "application/zip",
            AutoCloseStream = false,
            AutoResetStreamPosition = false,
        };
        put.Metadata["user-id"] = userId.ToString();
        put.Metadata["request-id"] = requestId.ToString();
        put.Metadata["sha256"] = Convert.ToHexString(hashBytes).ToLowerInvariant();

        await s3.PutObjectAsync(put, ct);

        return new AccountExportUploadResult(
            ObjectKey: objectKey,
            SizeBytes: buffer.Length,
            Sha256Hex: Convert.ToHexString(hashBytes).ToLowerInvariant());
    }

    public Task<string> GeneratePresignedUrlAsync(
        string objectKey,
        TimeSpan ttl,
        CancellationToken ct)
    {
        var req = new GetPreSignedUrlRequest
        {
            BucketName = _opts.ExportBucketName,
            Key = objectKey,
            Expires = DateTime.UtcNow.Add(ttl),
            Verb = HttpVerb.GET,
        };

        var url = s3.GetPreSignedURL(req);
        if (!string.IsNullOrEmpty(_opts.PublicEndpoint)
            && !_opts.PublicEndpoint.Equals(_opts.Endpoint, StringComparison.OrdinalIgnoreCase))
        {
            url = url.Replace(_opts.Endpoint, _opts.PublicEndpoint, StringComparison.OrdinalIgnoreCase);
        }
        return Task.FromResult(url);
    }
}
