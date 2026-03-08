using GetTrainMate.Api.Models;

namespace GetTrainMate.Api.Services.Ai;

public interface IAiProfileOptimizerService
{
    Task<ProfileOptimizeResponse> SuggestAsync(ProfileOptimizeRequest request, CancellationToken cancellationToken = default);
}
