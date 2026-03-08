namespace GetTrainMate.Api.Services;

/// <summary>
/// Stub: no retrieval. Replace with Bedrock Knowledge Base retrieve API when configured.
/// </summary>
public class BedrockKnowledgeBaseStub : IBedrockKnowledgeBase
{
    public Task<IReadOnlyList<KnowledgeBaseResult>> RetrieveAsync(string query, int maxResults = 5, CancellationToken cancellationToken = default)
        => Task.FromResult<IReadOnlyList<KnowledgeBaseResult>>(Array.Empty<KnowledgeBaseResult>());
}
