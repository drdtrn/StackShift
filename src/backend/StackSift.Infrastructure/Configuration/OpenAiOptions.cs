namespace StackSift.Infrastructure.Configuration;

public sealed class OpenAiOptions
{
    public string ApiKey { get; init; } = string.Empty;
    public string EmbeddingModel { get; init; } = "text-embedding-3-small";
    public string ChatModel { get; init; } = "gpt-4o-mini";
    public float Temperature { get; init; } = 0f;
}
