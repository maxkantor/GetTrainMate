using GetTrainMate.Api.Models;

namespace GetTrainMate.Api.Services.Ai;

public interface IAiIcebreakerService
{
    Task<IcebreakerResponse> GenerateAsync(IcebreakerRequest request, CancellationToken cancellationToken = default);
}
