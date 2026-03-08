namespace GetTrainMate.Api.Services;

/// <summary>
/// RAG layer for FAQ, help, trust & safety, product usage, pricing/credits.
/// AI assistant should use grounded retrieval instead of pure generation where possible.
/// </summary>
public interface IBedrockKnowledgeBase
{
    /// <summary>
    /// Retrieve relevant chunks for a query (e.g. "How do credits work?").
    /// Returns text snippets to inject into the model context.
    /// </summary>
    Task<IReadOnlyList<KnowledgeBaseResult>> RetrieveAsync(string query, int maxResults = 5, CancellationToken cancellationToken = default);
}

public record KnowledgeBaseResult(string Content, string? Source, double Score);
