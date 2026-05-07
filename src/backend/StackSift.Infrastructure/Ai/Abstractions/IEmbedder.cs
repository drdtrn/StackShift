using OpenAI.Embeddings;

namespace StackSift.Infrastructure.Ai.Abstractions;

public interface IEmbedder
{
    Task<OpenAIEmbedding> GenerateEmbeddingAsync(
        string input,
        EmbeddingGenerationOptions? options = null,
        CancellationToken cancellationToken = default);
}
