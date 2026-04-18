using Stripe.Checkout;

namespace GetTrainMate.Api.Infrastructure;

/// <summary>
/// One Stripe account can power many apps. Every endpoint receives the same events — each app must only
/// process sessions it created. GetTrainMate stamps <see cref="AppSourceKey"/> on Checkout Sessions.
/// </summary>
public static class StripeSessionOwnership
{
    /// <summary>Stripe metadata key — unique to this codebase; other apps should use their own key/value.</summary>
    public const string AppSourceKey = "gtm_source";

    public const string AppSourceValue = "gettrainmate";

    /// <summary>One-time payment for credit packs (mode=payment).</summary>
    public static bool IsGetTrainMateCreditsPayment(Session session)
    {
        var m = session.Metadata;
        if (m == null) return false;

        if (m.TryGetValue(AppSourceKey, out var src))
            return string.Equals(src.Trim(), AppSourceValue, StringComparison.OrdinalIgnoreCase);

        // Legacy sessions created before gtm_source (still require keys only GetTrainMate sets together)
        return m.ContainsKey("credits")
               && m.ContainsKey("packKey")
               && m.ContainsKey("priceUsd");
    }

    /// <summary>Subscription checkout (mode=subscription) or Stripe Subscription metadata.</summary>
    public static bool IsGetTrainMateSubscription(Session session)
    {
        if (!string.Equals(session.Mode, "subscription", StringComparison.OrdinalIgnoreCase))
            return false;
        return IsGetTrainMateSubscriptionMeta(session.Metadata);
    }

    /// <summary>Used for subscription webhooks (<see cref="Stripe.Subscription"/>) and checkout session metadata.</summary>
    public static bool IsGetTrainMateSubscriptionMeta(Dictionary<string, string>? metadata)
    {
        if (metadata == null) return false;

        if (metadata.TryGetValue(AppSourceKey, out var src))
            return string.Equals(src.Trim(), AppSourceValue, StringComparison.OrdinalIgnoreCase);

        // Legacy: subscription checkouts had userId + planKey only
        return metadata.ContainsKey("planKey") && metadata.ContainsKey("userId");
    }
}
