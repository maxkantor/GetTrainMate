using GetTrainMate.Api.Services;
using Microsoft.Extensions.Logging;

namespace GetTrainMate.Api.Services.Ai;

/// <summary>
/// Help assistant: retrieves from Knowledge Base (when configured) and answers using grounded context.
/// When no retrieval results, returns a short fallback suggesting support/FAQ.
/// </summary>
public class AiHelpAssistantService : IAiHelpAssistantService
{
    private readonly IBedrockKnowledgeBase _knowledgeBase;
    private readonly IBedrockChatService _chat;
    private readonly ILogger<AiHelpAssistantService> _logger;

    private const string SystemPrompt = @"You are the GetTrainMate help assistant. Answer ONLY using the provided context below. Be concise and trustworthy. If the context does not contain enough information, say: ""I don't have specific information on that. Check the FAQ or contact support."" Do not make up facts about pricing, features, or policies.

Context:
{0}";

    public AiHelpAssistantService(IBedrockKnowledgeBase knowledgeBase, IBedrockChatService chat, ILogger<AiHelpAssistantService> logger)
    {
        _knowledgeBase = knowledgeBase;
        _chat = chat;
        _logger = logger;
    }

    public async Task<string> AnswerAsync(string question, CancellationToken cancellationToken = default)
    {
        var results = await _knowledgeBase.RetrieveAsync(question, 5, cancellationToken);
        var context = results.Count > 0
            ? string.Join("\n\n", results.Select(r => r.Content))
            : "No specific documentation was retrieved. GetTrainMate is a training partner matching app. Credits are used to unlock chats and AI features. For account or billing issues, contact support.";
        var systemPrompt = string.Format(SystemPrompt, context);
        var response = await _chat.SendAsync(systemPrompt, Array.Empty<BedrockChatMessage>(), question, cancellationToken);
        return response.Content;
    }
}
