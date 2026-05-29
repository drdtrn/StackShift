namespace StackSift.Infrastructure.Storage;

public class S3StorageOptions
{
    public string Endpoint { get; set; } = "http://localhost:9000";

    /// <summary>
    /// Public-facing URL used in presigned download URLs.
    /// Override when the API connects to MinIO via an internal Docker hostname
    /// (e.g. http://minio:9000) but presigned URLs must be browser-accessible
    /// (e.g. http://localhost:9000).
    /// </summary>
    public string PublicEndpoint { get; set; } = "http://localhost:9000";

    public string AccessKey { get; set; } = string.Empty;
    public string SecretKey { get; set; } = string.Empty;
    public string BucketName { get; set; } = "stacksift-uploads";
    public string ExportBucketName { get; set; } = "stacksift-exports";
    public string Region { get; set; } = "us-east-1";
}
