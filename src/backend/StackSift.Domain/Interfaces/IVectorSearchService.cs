namespace StackSift.Domain.Interfaces;

public interface IVectorSearchService
{
    Task<float[]> EmbedAsync(string text, CancellationToken ct = default);

    Task<List<Guid>> FindSimilarAsync(
        float[] embedding,
        int topK,
        Guid? excludeId = null,
        CancellationToken ct = default);
}
