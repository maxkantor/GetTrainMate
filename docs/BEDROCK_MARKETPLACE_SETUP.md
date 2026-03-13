# Bedrock Model Access Setup

The **Model access** page has been retired. Serverless foundation models are now **automatically enabled on first invocation** in your account.

## For AWS Marketplace models (e.g. Anthropic Claude)

> A user with AWS Marketplace permissions must **invoke the model once** to enable it account-wide.

Our Lambda has those permissions. The **first** invocation from your app will trigger the subscription. If you previously saw:

```
Model access is denied... aws-marketplace:ViewSubscriptions, aws-marketplace:Subscribe
```

…that invocation failed before enabling. Now that the Lambda has `AWSMarketplaceManageSubscriptions` and `AmazonBedrockMarketplaceAccess`, the next invocation should:

1. Automatically complete the Marketplace subscription
2. Enable the model for your account

**Try the AI Coach again.** If it still fails:

- **Anthropic first-time:** You may need to submit use case details (Bedrock playground or Anthropic flow)
- **Billing:** Ensure a valid payment method is on file (Billing → Payment methods)
- **Wait:** AWS suggests retrying after ~2 minutes if permissions were recently updated

## IAM (in CDK)

The Lambda role has:

- `AmazonBedrockMarketplaceAccess` (managed policy)
- `AWSMarketplaceManageSubscriptions` (managed policy)
- Inline: `bedrock:InvokeModel`, `bedrock:InvokeModelWithResponseStream`, `aws-marketplace:ViewSubscriptions`, `aws-marketplace:Subscribe`, `aws-marketplace:Unsubscribe`
