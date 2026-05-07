using Microsoft.Extensions.Logging;
using StackSift.Domain.Interfaces;
using StackSift.Domain.Interfaces.Repositories;
using StackSift.Infrastructure.Ai.Abstractions;

namespace StackSift.Infrastructure.Ai;

public sealed class OpenAiVectorSearchService(
    IEmbedder embedder,
    IAiAnalysisRepository repo,
    ILogger<OpenAiVectorSearchService> logger)
    : IVectorSearchService
{
    private const int MaxTokens = 8_000;
    private const int CharsPerTokenEstimate = 4;
    private const int MaxChars = MaxTokens * CharsPerTokenEstimate;

    public async Task<float[]> EmbedAsync(string text, CancellationToken ct = default)
    {
        var input = text.Length > MaxChars ? text[..MaxChars] : text;

        var embedding = await embedder.GenerateEmbeddingAsync(input, cancellationToken: ct);

        var vector = embedding.ToFloats().ToArray();
        if (vector.Length != 1536)
            throw new InvalidOperationException(
                $"Embedding length {vector.Length} != 1536 (model returned wrong size).");

        logger.LogInformation(
            "Embedded {Chars} chars (truncated={Truncated}) with model text-embedding-3-small",
            input.Length, text.Length > MaxChars);

        return vector;
    }

    public async Task<List<Guid>> FindSimilarAsync(
        float[] embedding, int topK, Guid? excludeId = null, CancellationToken ct = default)
    {
        var matches = await repo.SearchSimilarAsync(embedding, topK, excludeId, ct);
        return matches.Select(a => a.Id).ToList();
    }
}
