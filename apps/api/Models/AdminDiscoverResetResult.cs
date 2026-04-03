namespace GetTrainMate.Api.Models;

/// <summary>Counts for admin-driven discover / relationship resets.</summary>
public class AdminDiscoverResetResult
{
    public int SkippedInteractionsRemoved { get; set; }
    public int OutgoingSentOrMatchedRemoved { get; set; }
    public int AllOutgoingInteractionsRemoved { get; set; }
    public int ReverseInteractionsRemoved { get; set; }
    public int DiscoverPassesRemoved { get; set; }
    public int MatchesRemoved { get; set; }
    public int ChatThreadsRemoved { get; set; }
    public int ChatMessagesRemoved { get; set; }
}
