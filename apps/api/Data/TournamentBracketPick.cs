namespace GetTrainMate.Api.Data;

/// <summary>Synthetic match id for tournament-wide bracket picks stored in the predictions table.</summary>
public static class TournamentBracketPick
{
    public const string MatchId = "tournament-bracket";
    public const int SemifinalistCount = 4;

    public static string PredictionKey(string userId) => $"{MatchId}#{userId}";
}
