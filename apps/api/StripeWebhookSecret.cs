namespace GetTrainMate.Api;

/// <summary>
/// Holds the Stripe webhook signing secret from SSM or env.
/// </summary>
public class StripeWebhookSecret
{
    public string Value { get; }

    public StripeWebhookSecret(string value)
    {
        Value = (value ?? string.Empty).Trim();
    }
}
