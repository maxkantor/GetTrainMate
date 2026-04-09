using GetTrainMate.Api.Models;

namespace GetTrainMate.Api.Services;

public interface ILandingMatchPreviewService
{
    Task<LandingMatchPreviewResponse> GetPreviewAsync(LandingMatchPreviewRequest request, CancellationToken cancellationToken = default);

    Task<LandingShowcaseResponse> GetShowcaseAsync(CancellationToken cancellationToken = default);
}
