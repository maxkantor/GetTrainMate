using GetTrainMate.Api.Models;

namespace GetTrainMate.Api.Services.PartnerOutreach;

/// <summary>
/// Separates FO0 queue inventory (draft/approved rows) from drafts that currently pass
/// <see cref="PartnerOutreachRules.EvaluateSendGate"/>. Does not mutate queue items.
/// </summary>
public sealed class Fo0SendReadinessResult
{
    public int InventoryDrafts { get; init; }
    public int SendableNow { get; init; }
    public int Blocked { get; init; }
    public IReadOnlyDictionary<string, int> BlockedByReason { get; init; } =
        new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);

    /// <summary>True when inventory exists but every draft is intentionally gated.</summary>
    public bool AllInventoryGated => InventoryDrafts > 0 && SendableNow == 0;
}

public static class Fo0SendReadiness
{
    public static bool IsInventoryDraft(PartnerQueueItem q) =>
        q.FollowUpNumber == 0
        && q.Status is "draft" or "approved" or "approved_for_next_send";

    /// <summary>
    /// Classify inventory drafts from already-evaluated gate codes.
    /// <paramref name="gateCodesForInventoryDrafts"/>: null = passes EvaluateSendGate (sendable).
    /// </summary>
    public static Fo0SendReadinessResult ClassifyFromGateCodes(
        IEnumerable<string?> gateCodesForInventoryDrafts,
        Func<string?, PartnerSendContext?, string>? mapReason = null)
    {
        mapReason ??= static (code, _) => WhyNotSent.FromGateCode(code);
        var blocked = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        var inventory = 0;
        var sendable = 0;
        foreach (var code in gateCodesForInventoryDrafts)
        {
            inventory++;
            if (code == null)
            {
                sendable++;
                continue;
            }
            var reason = mapReason(code, null);
            blocked[reason] = blocked.TryGetValue(reason, out var n) ? n + 1 : 1;
        }
        return new Fo0SendReadinessResult
        {
            InventoryDrafts = inventory,
            SendableNow = sendable,
            Blocked = inventory - sendable,
            BlockedByReason = blocked,
        };
    }
}
