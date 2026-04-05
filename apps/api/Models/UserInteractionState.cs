namespace GetTrainMate.Api.Models;

/// <summary>Per-viewer interaction with a target profile. One row per (userId, targetUserId).</summary>
public static class UserInteractionState
{
    public const string Skipped = "SKIPPED";
    public const string Sent = "SENT";
    public const string Matched = "MATCHED";
    /// <summary>Viewer withdrew a pending one-way invite; excluded from Discover until product allows replay.</summary>
    public const string Cancelled = "CANCELLED";
}
