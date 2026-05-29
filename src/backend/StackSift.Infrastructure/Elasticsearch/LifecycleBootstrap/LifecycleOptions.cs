namespace StackSift.Infrastructure.Elasticsearch.LifecycleBootstrap;

public sealed class LifecycleOptions
{
    public bool Enabled { get; init; } = true;

    /// <summary>
    /// The ILM policy applied by the <c>stacksift-logs-*</c> index template
    /// when no per-index policy is set explicitly. Defaults to the Free tier
    /// so a misconfigured org cannot accidentally retain logs forever.
    /// </summary>
    public string DefaultPolicy { get; init; } = "stacksift-logs-free";

    /// <summary>
    /// Hint surfaced in startup logs so operators can confirm the cluster
    /// boot picked the expected ILM defaults.
    /// </summary>
    public string PolicyHint { get; init; } = "free=3d, indie=30d, team=90d";

    public int NumberOfShards { get; init; } = 1;
    public int NumberOfReplicas { get; init; } = 1;

    public bool TeamSearchableSnapshotsEnabled { get; init; } = false;

    public SnapshotRepositoryOptions SnapshotRepository { get; init; } = new();
}

public sealed class SnapshotRepositoryOptions
{
    public string Name { get; init; } = "stacksift-logs-repo";
    public string Type { get; init; } = "s3";
    public string Bucket { get; init; } = "stacksift-es-backup";
    public string Endpoint { get; init; } = "";
    public string Region { get; init; } = "us-east-1";
    public bool ServerSideEncryption { get; init; } = true;
    public string BasePath { get; init; } = "stacksift";
    public bool PathStyleAccess { get; init; } = true;
}
