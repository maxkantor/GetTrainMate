using Stripe;

namespace GetTrainMate.Api.Infrastructure;

/// <summary>
/// Stripe.net ≥48 moved subscription billing-period timestamps onto each
/// <see cref="SubscriptionItem"/>. Prefer the first item's period end for entitlement expiry.
/// </summary>
public static class StripeSubscriptionPeriod
{
    public static DateTime? GetCurrentPeriodEnd(Subscription? subscription)
    {
        if (subscription?.Items?.Data == null || subscription.Items.Data.Count == 0)
            return null;
        return subscription.Items.Data[0].CurrentPeriodEnd;
    }
}
