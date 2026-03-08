namespace GetTrainMate.Api.Services.Ai;

public interface IAiHelpAssistantService
{
    Task<string> AnswerAsync(string question, CancellationToken cancellationToken = default);
}
