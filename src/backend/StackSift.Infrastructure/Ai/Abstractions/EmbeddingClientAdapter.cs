using OpenAI.Embeddings;

namespace StackSift.Infrastructure.Ai.Abstractions;

internal sealed class EmbeddingClientAdapter(EmbeddingClient client) : IEmbedder
{
    public async Task<OpenAIEmbedding> GenerateEmbeddingAsync(
        string input,
        EmbeddingGenerationOptions? options = null,
        CancellationToken cancellationToken = default)
    {
        var result = await client.GenerateEmbeddingAsync(input, options, cancellationToken);
        return result.Value;
    }
}
