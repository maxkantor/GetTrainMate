using GetTrainMate.Api.Models;

namespace GetTrainMate.Api.Services.Ai;

public interface IAiWorkoutPlannerService
{
    Task<WorkoutPlanResponse> GenerateAsync(WorkoutPlanRequest request, CancellationToken cancellationToken = default);
}
