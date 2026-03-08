using GetTrainMate.Api.Models;

namespace GetTrainMate.Api.Services.Ai;

public interface IAiMatchInsightService
{
    Task<MatchInsightResponse> GenerateAsync(MatchInsightRequest request, CancellationToken cancellationToken = default);
}
