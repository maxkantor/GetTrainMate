using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using Amazon.DynamoDBv2;
using Amazon.DynamoDBv2.DocumentModel;
using Amazon.DynamoDBv2.Model;
using GetTrainMate.Api.Constants;
using GetTrainMate.Api.Models;
using Stripe;
using Stripe.Checkout;

namespace GetTrainMate.Api.Services;

/// <summary>
/// Credits for all users: single source of truth is the user-credits table (Balance per UserId).
/// Balance = stored value; grants (free signup, purchase) and spends (like, chat unlock) update it.
/// Purchases are applied either when the user hits the success page (ConfirmCreditsPurchaseAsync) or when the Stripe webhook runs (ProcessCheckoutSessionCompletedAsync); both are idempotent. No webhook timing dependency.
/// </summary>
public class CreditsService : ICreditsService
{
    private const string CreditPackConfigTable = "gettrainmate-credit-pack-config";
    private const string UserCreditsTable = "gettrainmate-user-credits";
    private const string CreditTransactionsTable = "gettrainmate-credit-transactions";
    private const string StripeWebhookEventsTable = "gettrainmate-stripe-webhook-events";
    private const int FreeSignupCredits = 3;
    private const string FreeSignupReason = "FREE_SIGNUP";
    private const int DailyFreeDiscoverLikes = 5;

    private readonly IAmazonDynamoDB _dynamoDb;
    private readonly ILogger<CreditsService> _logger;
    private readonly IAdminNotificationService _adminNotify;

    public CreditsService(
        IAmazonDynamoDB dynamoDb,
        ILogger<CreditsService> logger,
        IAdminNotificationService adminNotify)
    {
        _dynamoDb = dynamoDb;
        _logger = logger;
        _adminNotify = adminNotify;
    }

    /// <summary>Preserves entitlement and daily-free-like counters when rewriting the user-credits item (full PutItem).</summary>
    private static void CopyPreservedUserCreditFields(Document? src, Document dest)
    {
        if (src == null) return;
        foreach (var key in new[] { "UnlimitedDiscovery", "DailyFreeLikesUtcDate", "DailyFreeLikesUsed", "BoostExpiresAtUtc", "RevealLikesUnlockedAt" })
        {
            if (src.Contains(key))
                dest[key] = src[key]!;
        }
    }

    private static Document BuildUserCreditsPutDocument(string userId, int balance, int lifetimeEarned, Document? previous)
    {
        var d = new Document
        {
            ["UserId"] = userId,
            ["Balance"] = balance,
            ["LifetimeEarned"] = lifetimeEarned,
            ["UpdatedAt"] = DateTime.UtcNow.ToString("O"),
        };
        CopyPreservedUserCreditFields(previous, d);
        return d;
    }

    /// <summary>Deterministic id so duplicate spend requests with the same refId do not double-charge (best-effort; see race note in SpendCreditsAsync).</summary>
    private static string DeterministicSpendTransactionId(string userId, string reason, string refId)
    {
        var raw = $"{userId}\n{reason}\n{refId}";
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(raw));
        return "sp_" + Convert.ToHexString(hash).ToLowerInvariant();
    }

    public async Task<(List<CreditPackDto> packs, string source)> GetActiveCreditPacksWithSourceAsync()
    {
        try
        {
            var table = Table.LoadTable(_dynamoDb, CreditPackConfigTable);
            var scan = table.Scan(new ScanFilter());
            var docs = await scan.GetNextSetAsync();
            var configs = docs.Select(ToCreditPackConfig).Where(c => c != null && c.IsActive).OrderBy(c => c!.SortOrder).ToList();
            if (configs.Count > 0)
            {
                var dtos = configs.Select(c => new CreditPackDto
                {
                    Key = c!.Key,
                    Title = c.Title,
                    PriceUsd = c.PriceUsd,
                    Credits = c.Credits,
                    IsActive = c.IsActive,
                    SortOrder = c.SortOrder,
                    IsBestValue = c.IsBestValue,
                }).ToList();
                return (dtos, "db");
            }
        }
        catch (ResourceNotFoundException ex)
        {
            _logger.LogWarning(ex, "Credit pack config table not found. Return fallback.");
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Error loading credit packs from DB. Return fallback.");
        }

        var fallback = CreditPacksFallback.Packs.Select(p => new CreditPackDto
        {
            Key = p.Key,
            Title = p.Title,
            PriceUsd = p.PriceUsd,
            Credits = p.Credits,
            IsActive = true,
            SortOrder = p.SortOrder,
            IsBestValue = p.IsBestValue,
        }).ToList();
        return (fallback, "default");
    }

    public async Task<CreditPackDto?> GetPackByKeyAsync(string packKey)
    {
        var config = await GetPackConfigByKeyAsync(packKey);
        if (config == null) return null;
        return new CreditPackDto
        {
            Key = config.Key,
            Title = config.Title,
            PriceUsd = config.PriceUsd,
            Credits = config.Credits,
            IsActive = config.IsActive,
            SortOrder = config.SortOrder,
            IsBestValue = config.IsBestValue,
        };
    }

    private async Task<CreditPackConfig?> GetPackConfigByKeyAsync(string packKey)
    {
        if (string.IsNullOrWhiteSpace(packKey)) return null;
        var normalized = PricingPlanCatalog.NormalizePackKey(packKey);

        try
        {
            var table = Table.LoadTable(_dynamoDb, CreditPackConfigTable);
            Document? doc = await table.GetItemAsync(normalized);
            var resolved = TryResolvePackConfigFromDocument(doc, normalized);
            if (resolved != null)
                return resolved;

            if (!string.Equals(normalized, packKey, StringComparison.OrdinalIgnoreCase))
            {
                doc = await table.GetItemAsync(packKey);
                resolved = TryResolvePackConfigFromDocument(doc, normalized);
                if (resolved != null)
                    return resolved;
            }

            var fallback = PricingPlanCatalog.TryGetFallbackPack(packKey);
            if (fallback != null)
                return new CreditPackConfig
                {
                    Key = fallback.Key,
                    Title = fallback.Title,
                    PriceUsd = fallback.PriceUsd,
                    Credits = fallback.Credits,
                    IsActive = true,
                    SortOrder = fallback.SortOrder,
                    IsBestValue = fallback.IsBestValue,
                };
        }
        catch (ResourceNotFoundException) { }
        catch (Exception ex) { _logger.LogWarning(ex, "GetPackConfigByKey {Key}", packKey); }

        return null;
    }

    /// <summary>
    /// If Dynamo has an inactive row for a canonical key, the web client may still show that pack (it merges catalog fallbacks).
    /// Checkout must use the same canonical catalog for those keys; otherwise users see a pack they cannot buy.
    /// </summary>
    private static CreditPackConfig? TryResolvePackConfigFromDocument(Document? doc, string normalizedPackKey)
    {
        if (doc == null) return null;
        var cfg = ToCreditPackConfig(doc);
        if (cfg == null) return null;
        if (cfg.IsActive) return cfg;

        var fb = PricingPlanCatalog.TryGetFallbackPack(normalizedPackKey);
        if (fb != null && string.Equals(fb.Key, cfg.Key, StringComparison.OrdinalIgnoreCase))
        {
            return new CreditPackConfig
            {
                Key = fb.Key,
                Title = fb.Title,
                PriceUsd = fb.PriceUsd,
                Credits = fb.Credits,
                IsActive = true,
                SortOrder = fb.SortOrder,
                IsBestValue = fb.IsBestValue,
            };
        }

        return null;
    }

    public async Task<string> CreateCreditsCheckoutSessionAsync(string userId, string packKey, string baseUrl)
    {
        if (PricingPlanCatalog.IsFreePackKey(packKey))
            throw new ArgumentException("Free pack does not require checkout. Use grant-free-signup.");

        var pack = await GetPackConfigByKeyAsync(packKey);
        if (pack == null || !pack.IsActive)
            throw new InvalidOperationException($"Pack {packKey} not found or inactive.");
        if (pack.PriceUsd <= 0)
            throw new InvalidOperationException($"Pack {packKey} has invalid price. Configure in Admin CRM → Credit Packs.");

        var canonicalPackKey = PricingPlanCatalog.NormalizePackKey(pack.Key);

        var baseUrlClean = baseUrl.TrimEnd('/');
        var successUrl = $"{baseUrlClean}/billing/success?session_id={{CHECKOUT_SESSION_ID}}";
        var cancelUrl = $"{baseUrlClean}/billing/cancel";

        var amountCents = (long)(pack.PriceUsd * 100);
        var options = new SessionCreateOptions
        {
            PaymentMethodTypes = new List<string> { "card" },
            LineItems = new List<SessionLineItemOptions>
            {
                new()
                {
                    PriceData = new SessionLineItemPriceDataOptions
                    {
                        Currency = "usd",
                        UnitAmount = amountCents,
                        ProductData = new SessionLineItemPriceDataProductDataOptions
                        {
                            Name = $"{pack.Title} - {pack.Credits} Credits",
                            Description = $"GetTrainMate {pack.Credits} Credits",
                        },
                    },
                    Quantity = 1,
                },
            },
            Mode = "payment",
            SuccessUrl = successUrl,
            CancelUrl = cancelUrl,
            ClientReferenceId = userId,
            Metadata = new Dictionary<string, string>
            {
                { "userId", userId },
                { "packKey", canonicalPackKey },
                { "credits", pack.Credits.ToString() },
                { "priceUsd", pack.PriceUsd.ToString("F2") },
            },
        };

        var service = new SessionService();
        var session = await service.CreateAsync(options);

        if (string.IsNullOrEmpty(session.Url))
            throw new InvalidOperationException("Stripe did not return a checkout URL.");

        _logger.LogInformation("Credits checkout session created for user {UserId}, pack {PackKey}", userId, canonicalPackKey);
        return session.Url;
    }

    /// <summary>Apply credits for a paid checkout session (success-page flow). Idempotent; safe to call from frontend when user lands on /billing/success. Does not depend on webhook timing.</summary>
    public async Task<CreditsBalanceDto?> ConfirmCreditsPurchaseAsync(string sessionId, string userId)
    {
        if (string.IsNullOrWhiteSpace(sessionId))
            return null;

        Stripe.Checkout.Session session;
        try
        {
            var sessionService = new SessionService();
            session = await sessionService.GetAsync(sessionId);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "ConfirmCreditsPurchase: could not fetch Stripe session {SessionId}", sessionId);
            return null;
        }

        if (session.Mode != "payment" || session.PaymentStatus != "paid")
            return null;

        if (session.Metadata == null || !session.Metadata.ContainsKey("credits"))
        {
            try
            {
                var sessionService = new SessionService();
                session = await sessionService.GetAsync(session.Id);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "ConfirmCreditsPurchase: could not refetch session {SessionId} for metadata", session.Id);
                return null;
            }
        }

        var sessionUserId = session.ClientReferenceId ?? session.Metadata?.GetValueOrDefault("userId");
        if (string.IsNullOrEmpty(sessionUserId) || !string.Equals(sessionUserId, userId, StringComparison.OrdinalIgnoreCase))
        {
            _logger.LogWarning("ConfirmCreditsPurchase: session userId mismatch. SessionUserId={SessionUserId}, RequestUserId={UserId}", sessionUserId, userId);
            return null;
        }

        var packKey = session.Metadata?.GetValueOrDefault("packKey");
        var creditsStr = session.Metadata?.GetValueOrDefault("credits");
        if (string.IsNullOrEmpty(packKey) || !int.TryParse(creditsStr, out var credits) || credits <= 0)
        {
            _logger.LogWarning("ConfirmCreditsPurchase: session missing packKey or credits. SessionId={SessionId}", session.Id);
            return null;
        }

        var txTable = Table.LoadTable(_dynamoDb, CreditTransactionsTable);
        var scanFilter = new ScanFilter();
        scanFilter.AddCondition("StripeCheckoutSessionId", ScanOperator.Equal, session.Id);
        var search = txTable.Scan(scanFilter);
        var existingTx = await search.GetNextSetAsync();
        if (existingTx.Count > 0)
        {
            _logger.LogInformation("ConfirmCreditsPurchase: session {SessionId} already credited (idempotent).", session.Id);
            return await GetCreditsBalanceAsync(userId);
        }

        try
        {
            var userTable = Table.LoadTable(_dynamoDb, UserCreditsTable);
            var userDoc = await userTable.GetItemAsync(userId);
            var balance = 0;
            var lifetimeEarned = 0;
            if (userDoc != null)
            {
                balance = userDoc.Contains("Balance") ? userDoc["Balance"].AsInt() : 0;
                lifetimeEarned = userDoc.Contains("LifetimeEarned") ? userDoc["LifetimeEarned"].AsInt() : 0;
            }

            var balanceBeforePurchase = balance;
            balance += credits;
            lifetimeEarned += credits;

            await userTable.PutItemAsync(BuildUserCreditsPutDocument(userId, balance, lifetimeEarned, userDoc));

            var txId = Guid.NewGuid().ToString("N");
            var txDoc = new Document
            {
                ["Id"] = txId,
                ["UserId"] = userId,
                ["Type"] = CreditTransactionType.Purchase,
                ["CreditsDelta"] = credits,
                ["Reason"] = packKey,
                ["StripeCheckoutSessionId"] = session.Id,
                ["CreatedAt"] = DateTime.UtcNow.ToString("O"),
                ["BalanceBefore"] = balanceBeforePurchase,
                ["BalanceAfter"] = balance,
            };
            if (!string.IsNullOrEmpty(session.PaymentIntentId))
                txDoc["StripePaymentIntentId"] = session.PaymentIntentId;
            await txTable.PutItemAsync(txDoc);

            _logger.LogInformation("ConfirmCreditsPurchase: credited user {UserId} with {Credits} credits (session {SessionId}).", userId, credits, session.Id);
            _ = _adminNotify.NotifyCreditsPurchaseAsync(
                userId,
                credits,
                packKey,
                session.Id,
                session.PaymentIntentId,
                session.AmountTotal,
                session.Currency,
                CancellationToken.None);
            return await GetCreditsBalanceAsync(userId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "ConfirmCreditsPurchase: failed to credit user for session {SessionId}", session.Id);
            return null;
        }
    }

    public async Task<bool> ProcessCheckoutSessionCompletedAsync(string stripeEventId, Stripe.Checkout.Session session)
    {
        if (session.Mode != "payment" || session.PaymentStatus != "paid")
            return false;

        // Webhook payload can omit metadata; fetch full session if needed
        if (session.Metadata == null || !session.Metadata.ContainsKey("credits"))
        {
            try
            {
                var sessionService = new SessionService();
                session = await sessionService.GetAsync(session.Id);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Could not fetch session {SessionId} for metadata", session.Id);
            }
        }

        var userId = session.ClientReferenceId ?? session.Metadata?.GetValueOrDefault("userId");
        var packKey = session.Metadata?.GetValueOrDefault("packKey");
        var creditsStr = session.Metadata?.GetValueOrDefault("credits");
        if (string.IsNullOrEmpty(userId) || string.IsNullOrEmpty(packKey) || !int.TryParse(creditsStr, out var credits) || credits <= 0)
        {
            _logger.LogWarning("Checkout session missing metadata: userId, packKey, or credits. SessionId={SessionId}", session.Id);
            return false;
        }

        var eventsTable = Table.LoadTable(_dynamoDb, StripeWebhookEventsTable);
        try
        {
            var existingEvent = await eventsTable.GetItemAsync(stripeEventId);
            if (existingEvent != null)
            {
                var status = existingEvent.Contains("Status") ? existingEvent["Status"].AsString() : "";
                if (status == "PROCESSED")
                {
                    _logger.LogInformation("Stripe event {EventId} already processed (idempotent skip).", stripeEventId);
                    return true;
                }
                if (status == "FAILED")
                    _logger.LogWarning("Stripe event {EventId} was previously marked FAILED.", stripeEventId);
            }
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Could not load webhook event {EventId}", stripeEventId);
        }

        var txTable = Table.LoadTable(_dynamoDb, CreditTransactionsTable);
        var scanFilter = new ScanFilter();
        scanFilter.AddCondition("StripeCheckoutSessionId", ScanOperator.Equal, session.Id);
        var search = txTable.Scan(scanFilter);
        var existingTx = await search.GetNextSetAsync();
        if (existingTx.Count > 0)
        {
            _logger.LogInformation("Checkout session {SessionId} already credited (idempotent skip).", session.Id);
            await MarkWebhookEventProcessedAsync(eventsTable, stripeEventId, null);
            return true;
        }

        try
        {
            var userTable = Table.LoadTable(_dynamoDb, UserCreditsTable);
            var userDoc = await userTable.GetItemAsync(userId);
            var balance = 0;
            var lifetimeEarned = 0;
            if (userDoc != null)
            {
                balance = userDoc.Contains("Balance") ? userDoc["Balance"].AsInt() : 0;
                lifetimeEarned = userDoc.Contains("LifetimeEarned") ? userDoc["LifetimeEarned"].AsInt() : 0;
            }

            var balanceBeforeWebhook = balance;
            balance += credits;
            lifetimeEarned += credits;

            await userTable.PutItemAsync(BuildUserCreditsPutDocument(userId, balance, lifetimeEarned, userDoc));

            var txId = Guid.NewGuid().ToString("N");
            var txDoc = new Document
            {
                ["Id"] = txId,
                ["UserId"] = userId,
                ["Type"] = CreditTransactionType.Purchase,
                ["CreditsDelta"] = credits,
                ["Reason"] = packKey,
                ["StripeCheckoutSessionId"] = session.Id,
                ["CreatedAt"] = DateTime.UtcNow.ToString("O"),
                ["BalanceBefore"] = balanceBeforeWebhook,
                ["BalanceAfter"] = balance,
            };
            if (!string.IsNullOrEmpty(session.PaymentIntentId))
                txDoc["StripePaymentIntentId"] = session.PaymentIntentId;
            await txTable.PutItemAsync(txDoc);

            await MarkWebhookEventProcessedAsync(eventsTable, stripeEventId, null);
            _logger.LogInformation("Credited user {UserId} with {Credits} credits (session {SessionId}).", userId, credits, session.Id);
            _ = _adminNotify.NotifyCreditsPurchaseAsync(
                userId,
                credits,
                packKey,
                session.Id,
                session.PaymentIntentId,
                session.AmountTotal,
                session.Currency,
                CancellationToken.None);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to credit user for session {SessionId}", session.Id);
            await MarkWebhookEventFailedAsync(eventsTable, stripeEventId, ex.Message);
            return false;
        }
    }

    public async Task<CreditsBalanceDto> GetCreditsBalanceAsync(string userId)
    {
        try
        {
            var table = Table.LoadTable(_dynamoDb, UserCreditsTable);
            var doc = await table.GetItemAsync(userId);
            if (doc != null)
            {
                DateTime? boostEnd = null;
                if (doc.Contains("BoostExpiresAtUtc") && DateTime.TryParse(doc["BoostExpiresAtUtc"].AsString(), CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind, out var be))
                    boostEnd = be.ToUniversalTime();
                var reveal = doc.Contains("RevealLikesUnlockedAt") && !string.IsNullOrWhiteSpace(doc["RevealLikesUnlockedAt"].AsString());
                return new CreditsBalanceDto
                {
                    Balance = doc.Contains("Balance") ? doc["Balance"].AsInt() : 0,
                    LifetimeEarned = doc.Contains("LifetimeEarned") ? doc["LifetimeEarned"].AsInt() : 0,
                    UnlimitedDiscovery = doc.Contains("UnlimitedDiscovery") && doc["UnlimitedDiscovery"].AsBoolean(),
                    BoostExpiresAtUtc = boostEnd,
                    RevealLikesUnlocked = reveal,
                };
            }
        }
        catch (ResourceNotFoundException) { }
        catch (Exception ex) { _logger.LogWarning(ex, "GetCreditsBalance {UserId}", userId); }

        return new CreditsBalanceDto { Balance = 0, LifetimeEarned = 0, UnlimitedDiscovery = false };
    }

    public async Task<bool> HasReceivedFreeSignupCreditsAsync(string userId) =>
        await HasFreeSignupGrantInLedgerAsync(userId);

    private async Task<bool> HasFreeSignupGrantInLedgerAsync(string userId)
    {
        var txTable = Table.LoadTable(_dynamoDb, CreditTransactionsTable);
        var userIdFilter = new ScanFilter();
        userIdFilter.AddCondition("UserId", ScanOperator.Equal, userId);
        var userIdSearch = txTable.Scan(userIdFilter);
        var existing = await userIdSearch.GetNextSetAsync();
        return existing.Any(d => d.Contains("Reason") && d["Reason"].AsString() == FreeSignupReason);
    }

    public async Task<GrantFreeSignupCreditsResult> GrantFreeSignupCreditsAsync(string userId, string? signupEmail = null)
    {
        var txTable = Table.LoadTable(_dynamoDb, CreditTransactionsTable);
        var userTable = Table.LoadTable(_dynamoDb, UserCreditsTable);

        if (await HasFreeSignupGrantInLedgerAsync(userId))
        {
            _logger.LogInformation("Free signup credits already granted for user {UserId}.", userId);
            return new GrantFreeSignupCreditsResult { Success = true, AlreadyGranted = true };
        }

        try
        {
            var userDoc = await userTable.GetItemAsync(userId);
            var balance = 0;
            var lifetimeEarned = 0;
            if (userDoc != null)
            {
                balance = userDoc.Contains("Balance") ? userDoc["Balance"].AsInt() : 0;
                lifetimeEarned = userDoc.Contains("LifetimeEarned") ? userDoc["LifetimeEarned"].AsInt() : 0;
            }
            balance += FreeSignupCredits;
            lifetimeEarned += FreeSignupCredits;

            await userTable.PutItemAsync(BuildUserCreditsPutDocument(userId, balance, lifetimeEarned, userDoc));

            var balanceBeforeSignup = balance - FreeSignupCredits;
            var txId = Guid.NewGuid().ToString("N");
            await txTable.PutItemAsync(new Document
            {
                ["Id"] = txId,
                ["UserId"] = userId,
                ["Type"] = CreditTransactionType.Grant,
                ["CreditsDelta"] = FreeSignupCredits,
                ["Reason"] = FreeSignupReason,
                ["CreatedAt"] = DateTime.UtcNow.ToString("O"),
                ["BalanceBefore"] = balanceBeforeSignup,
                ["BalanceAfter"] = balance,
            });

            _logger.LogInformation("Granted {Credits} free signup credits to user {UserId}.", FreeSignupCredits, userId);
            _ = _adminNotify.NotifyNewSignupAsync(userId, signupEmail, CancellationToken.None);
            return new GrantFreeSignupCreditsResult { Success = true, AlreadyGranted = false };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to grant free signup credits to user {UserId}", userId);
            return new GrantFreeSignupCreditsResult { Success = false, AlreadyGranted = false };
        }
    }

    public async Task GrantCreditsAsync(string userId, int amount, string reason)
    {
        if (amount <= 0)
            throw new ArgumentException("Amount must be positive.", nameof(amount));

        var userTable = Table.LoadTable(_dynamoDb, UserCreditsTable);
        var userDoc = await userTable.GetItemAsync(userId);
        var balance = 0;
        var lifetimeEarned = 0;
        if (userDoc != null)
        {
            balance = userDoc.Contains("Balance") ? userDoc["Balance"].AsInt() : 0;
            lifetimeEarned = userDoc.Contains("LifetimeEarned") ? userDoc["LifetimeEarned"].AsInt() : 0;
        }

        var balanceBefore = balance;
        balance += amount;
        lifetimeEarned += amount;

        await userTable.PutItemAsync(BuildUserCreditsPutDocument(userId, balance, lifetimeEarned, userDoc));

        var txTable = Table.LoadTable(_dynamoDb, CreditTransactionsTable);
        var txId = Guid.NewGuid().ToString("N");
        await txTable.PutItemAsync(new Document
        {
            ["Id"] = txId,
            ["UserId"] = userId,
            ["Type"] = CreditTransactionType.Grant,
            ["CreditsDelta"] = amount,
            ["Reason"] = reason,
            ["CreatedAt"] = DateTime.UtcNow.ToString("O"),
            ["BalanceBefore"] = balanceBefore,
            ["BalanceAfter"] = balance,
        });

        _logger.LogInformation("Granted {Amount} credits to user {UserId}, reason={Reason}, newBalance={NewBalance}", amount, userId, reason, balance);
    }

    public async Task SpendCreditsAsync(string userId, int amount, string reason, string? refId = null, bool idempotent = false)
    {
        if (amount <= 0)
            throw new ArgumentException("Amount must be positive.", nameof(amount));

        var txTable = Table.LoadTable(_dynamoDb, CreditTransactionsTable);
        string txId;
        if (idempotent && !string.IsNullOrEmpty(refId))
        {
            txId = DeterministicSpendTransactionId(userId, reason, refId);
            var prior = await txTable.GetItemAsync(txId);
            if (prior != null
                && prior.Contains("UserId")
                && string.Equals(prior["UserId"].AsString(), userId, StringComparison.Ordinal)
                && prior.Contains("Type")
                && prior["Type"].AsString() == CreditTransactionType.Spend)
            {
                _logger.LogInformation("Spend idempotent skip: user {UserId} reason {Reason} ref {RefId}", userId, reason, refId);
                return;
            }
        }
        else
            txId = Guid.NewGuid().ToString("N");

        var userTable = Table.LoadTable(_dynamoDb, UserCreditsTable);
        var userDoc = await userTable.GetItemAsync(userId);
        var balance = 0;
        var lifetimeEarned = 0;
        if (userDoc != null)
        {
            balance = userDoc.Contains("Balance") ? userDoc["Balance"].AsInt() : 0;
            lifetimeEarned = userDoc.Contains("LifetimeEarned") ? userDoc["LifetimeEarned"].AsInt() : 0;
        }

        if (balance < amount)
        {
            _logger.LogWarning("Insufficient credits for user {UserId}: balance={Balance}, required={Amount}, reason={Reason}", userId, balance, amount, reason);
            throw new InsufficientCreditsException($"Insufficient credits. Balance: {balance}, required: {amount}.");
        }

        var newBalance = balance - amount;
        await userTable.PutItemAsync(BuildUserCreditsPutDocument(userId, newBalance, lifetimeEarned, userDoc));

        var txDoc = new Document
        {
            ["Id"] = txId,
            ["UserId"] = userId,
            ["Type"] = CreditTransactionType.Spend,
            ["CreditsDelta"] = -amount,
            ["Reason"] = reason,
            ["CreatedAt"] = DateTime.UtcNow.ToString("O"),
            ["BalanceBefore"] = balance,
            ["BalanceAfter"] = newBalance,
        };
        if (!string.IsNullOrEmpty(refId))
            txDoc["RefId"] = refId;
        await txTable.PutItemAsync(txDoc);

        _logger.LogInformation("Spent {Amount} credits for user {UserId}, reason={Reason}, newBalance={NewBalance}", amount, userId, reason, newBalance);
    }

    public async Task ChargeLikeForDiscoverAsync(string userId, string targetUserId)
    {
        if (string.IsNullOrEmpty(targetUserId))
            throw new ArgumentException("Target user required.", nameof(targetUserId));

        var likeRefId = $"like:{userId}:{targetUserId}";
        var txTable = Table.LoadTable(_dynamoDb, CreditTransactionsTable);
        var dedupeId = DeterministicSpendTransactionId(userId, CreditLedgerReason.Like, likeRefId);
        var existingLike = await txTable.GetItemAsync(dedupeId);
        if (existingLike != null)
        {
            _logger.LogInformation("Discover like idempotent skip: {UserId} -> {Target}", userId, targetUserId);
            return;
        }

        var freeDailyId = $"freedailylike:{userId}:{targetUserId}:{DateTime.UtcNow:yyyy-MM-dd}";
        var freeDedupe = DeterministicSpendTransactionId(userId, CreditLedgerReason.FreeDailyDiscoverLike, freeDailyId);
        var existingFree = await txTable.GetItemAsync(freeDedupe);
        if (existingFree != null)
        {
            _logger.LogInformation("Discover free-daily like idempotent skip: {UserId} -> {Target}", userId, targetUserId);
            return;
        }

        var balanceDto = await GetCreditsBalanceAsync(userId);
        if (balanceDto.Balance >= CreditRules.DiscoverSendLike)
        {
            await SpendCreditsAsync(userId, CreditRules.DiscoverSendLike, CreditLedgerReason.Like, likeRefId, idempotent: true);
            return;
        }

        var today = DateTime.UtcNow.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
        var userTable = Table.LoadTable(_dynamoDb, UserCreditsTable);
        var userDoc = await userTable.GetItemAsync(userId) ?? new Document { ["UserId"] = userId };

        var dateStr = userDoc.Contains("DailyFreeLikesUtcDate") ? userDoc["DailyFreeLikesUtcDate"].AsString() : null;
        var used = userDoc.Contains("DailyFreeLikesUsed") ? userDoc["DailyFreeLikesUsed"].AsInt() : 0;
        if (dateStr != today)
        {
            used = 0;
            dateStr = today;
        }

        if (used >= DailyFreeDiscoverLikes)
        {
            _logger.LogWarning("Discover like: user {UserId} exhausted free daily likes ({Limit})", userId, DailyFreeDiscoverLikes);
            throw new InsufficientCreditsException(
                $"You've used today's {DailyFreeDiscoverLikes} free matches. Add credits to send more, or try again after midnight UTC.");
        }

        used++;
        var balance = userDoc.Contains("Balance") ? userDoc["Balance"].AsInt() : 0;
        var lifetimeEarned = userDoc.Contains("LifetimeEarned") ? userDoc["LifetimeEarned"].AsInt() : 0;

        var nextUser = BuildUserCreditsPutDocument(userId, balance, lifetimeEarned, userDoc);
        nextUser["DailyFreeLikesUtcDate"] = dateStr!;
        nextUser["DailyFreeLikesUsed"] = used;
        await userTable.PutItemAsync(nextUser);

        await txTable.PutItemAsync(new Document
        {
            ["Id"] = freeDedupe,
            ["UserId"] = userId,
            ["Type"] = CreditTransactionType.Spend,
            ["CreditsDelta"] = 0,
            ["Reason"] = CreditLedgerReason.FreeDailyDiscoverLike,
            ["RefId"] = likeRefId,
            ["CreatedAt"] = DateTime.UtcNow.ToString("O"),
            ["BalanceBefore"] = balance,
            ["BalanceAfter"] = balance,
        });

        _logger.LogInformation("Discover like: user {UserId} used free daily like {Used}/{Limit} (target {Target})", userId, used, DailyFreeDiscoverLikes, targetUserId);
    }

    public async Task SetUnlimitedDiscoveryAsync(string userId, bool enabled)
    {
        var userTable = Table.LoadTable(_dynamoDb, UserCreditsTable);
        var userDoc = await userTable.GetItemAsync(userId);
        var balance = userDoc != null && userDoc.Contains("Balance") ? userDoc["Balance"].AsInt() : 0;
        var lifetimeEarned = userDoc != null && userDoc.Contains("LifetimeEarned") ? userDoc["LifetimeEarned"].AsInt() : 0;
        var next = BuildUserCreditsPutDocument(userId, balance, lifetimeEarned, userDoc);
        next["UnlimitedDiscovery"] = enabled;
        await userTable.PutItemAsync(next);
        _logger.LogInformation("Set UnlimitedDiscovery={Enabled} for user {UserId}", enabled, userId);
    }

    public async Task RecordWebhookEventReceivedAsync(string eventId, string type)
    {
        try
        {
            var table = Table.LoadTable(_dynamoDb, StripeWebhookEventsTable);
            await table.PutItemAsync(new Document
            {
                ["EventId"] = eventId,
                ["Type"] = type,
                ["ReceivedAt"] = DateTime.UtcNow.ToString("O"),
                ["Status"] = "RECEIVED",
            });
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Could not record webhook event {EventId}", eventId);
        }
    }

    private static async Task MarkWebhookEventProcessedAsync(Table table, string eventId, string? error)
    {
        try
        {
            var doc = await table.GetItemAsync(eventId);
            if (doc != null)
            {
                doc["ProcessedAt"] = DateTime.UtcNow.ToString("O");
                doc["Status"] = "PROCESSED";
                if (!string.IsNullOrEmpty(error)) doc["Error"] = error;
                await table.UpdateItemAsync(doc);
            }
            else
            {
                await table.PutItemAsync(new Document
                {
                    ["EventId"] = eventId,
                    ["Type"] = "checkout.session.completed",
                    ["ReceivedAt"] = DateTime.UtcNow.ToString("O"),
                    ["ProcessedAt"] = DateTime.UtcNow.ToString("O"),
                    ["Status"] = "PROCESSED",
                });
            }
        }
        catch (Exception) { /* best effort */ }
    }

    private static async Task MarkWebhookEventFailedAsync(Table table, string eventId, string error)
    {
        try
        {
            var doc = await table.GetItemAsync(eventId);
            if (doc != null)
            {
                doc["ProcessedAt"] = DateTime.UtcNow.ToString("O");
                doc["Status"] = "FAILED";
                doc["Error"] = error;
                await table.UpdateItemAsync(doc);
            }
            else
            {
                await table.PutItemAsync(new Document
                {
                    ["EventId"] = eventId,
                    ["Type"] = "checkout.session.completed",
                    ["ReceivedAt"] = DateTime.UtcNow.ToString("O"),
                    ["ProcessedAt"] = DateTime.UtcNow.ToString("O"),
                    ["Status"] = "FAILED",
                    ["Error"] = error,
                });
            }
        }
        catch (Exception) { /* best effort */ }
    }

    public async Task<List<CreditPackConfig>> GetAllCreditPacksForAdminAsync()
    {
        try
        {
            var table = Table.LoadTable(_dynamoDb, CreditPackConfigTable);
            var scan = table.Scan(new ScanFilter());
            var docs = await scan.GetNextSetAsync();
            var list = docs.Select(ToCreditPackConfig).Where(c => c != null).OrderBy(c => c!.SortOrder).ToList();
            if (list.Count > 0) return list!;
        }
        catch (ResourceNotFoundException) { }
        catch (Exception ex) { _logger.LogWarning(ex, "GetAllCreditPacksForAdmin"); }

        return CreditPacksFallback.Packs.Select(p => new CreditPackConfig
        {
            Key = p.Key,
            Title = p.Title,
            PriceUsd = p.PriceUsd,
            Credits = p.Credits,
            IsActive = true,
            SortOrder = p.SortOrder,
            IsBestValue = p.IsBestValue,
            UpdatedAt = DateTime.UtcNow,
        }).ToList();
    }

    public async Task SaveCreditPackAsync(CreditPackConfig pack)
    {
        var table = Table.LoadTable(_dynamoDb, CreditPackConfigTable);
        pack.UpdatedAt = DateTime.UtcNow;
        var doc = new Document
        {
            ["Key"] = pack.Key,
            ["Title"] = pack.Title,
            ["PriceUsd"] = pack.PriceUsd,
            ["Credits"] = pack.Credits,
            ["IsActive"] = pack.IsActive,
            ["SortOrder"] = pack.SortOrder,
            ["IsBestValue"] = pack.IsBestValue,
            ["UpdatedAt"] = pack.UpdatedAt.ToString("O"),
        };
        if (!string.IsNullOrEmpty(pack.StripePriceId))
            doc["StripePriceId"] = pack.StripePriceId;
        await table.PutItemAsync(doc);
    }

    public async Task SeedDefaultCreditPacksIfEmptyAsync()
    {
        try
        {
            var table = Table.LoadTable(_dynamoDb, CreditPackConfigTable);
            var scan = table.Scan(new ScanFilter());
            var docs = await scan.GetNextSetAsync();
            if (docs.Count > 0)
            {
                _logger.LogInformation("Credit packs already exist ({Count}). Skip seed.", docs.Count);
                return;
            }
        }
        catch (ResourceNotFoundException)
        {
            _logger.LogWarning("Credit pack config table not found. Cannot seed.");
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Error checking credit packs. Attempting seed.");
        }

        foreach (var p in CreditPacksFallback.Packs)
        {
            await SaveCreditPackAsync(new CreditPackConfig
            {
                Key = p.Key,
                Title = p.Title,
                PriceUsd = p.PriceUsd,
                Credits = p.Credits,
                IsActive = true,
                SortOrder = p.SortOrder,
                IsBestValue = p.IsBestValue,
                UpdatedAt = DateTime.UtcNow,
            });
        }
        _logger.LogInformation("Credit packs seeded (starter, go, best_value, power, elite).");
    }

    public async Task<int> SyncCanonicalCreditPacksAsync()
    {
        var upserted = 0;
        foreach (var p in PricingPlanCatalog.CanonicalPacks)
        {
            await SaveCreditPackAsync(new CreditPackConfig
            {
                Key = p.Key,
                Title = p.Title,
                PriceUsd = p.PriceUsd,
                Credits = p.Credits,
                IsActive = true,
                SortOrder = p.SortOrder,
                IsBestValue = p.IsBestValue,
                UpdatedAt = DateTime.UtcNow,
            });
            upserted++;
        }

        try
        {
            var table = Table.LoadTable(_dynamoDb, CreditPackConfigTable);
            foreach (var legacyKey in PricingPlanCatalog.LegacyPackKeys)
            {
                Document? doc;
                try
                {
                    doc = await table.GetItemAsync(legacyKey);
                }
                catch (ResourceNotFoundException)
                {
                    continue;
                }

                if (doc == null) continue;
                var cfg = ToCreditPackConfig(doc);
                if (cfg == null) continue;
                cfg.IsActive = false;
                await SaveCreditPackAsync(cfg);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Could not deactivate legacy credit pack rows.");
        }

        return upserted;
    }

    private static CreditPackConfig? ToCreditPackConfig(Document doc)
    {
        if (!doc.Contains("Key")) return null;
        return new CreditPackConfig
        {
            Key = doc["Key"].AsString(),
            Title = doc.Contains("Title") ? doc["Title"].AsString() : "",
            PriceUsd = doc.Contains("PriceUsd") ? doc["PriceUsd"].AsDecimal() : 0,
            Credits = doc.Contains("Credits") ? doc["Credits"].AsInt() : 0,
            IsActive = !doc.Contains("IsActive") || doc["IsActive"].AsBoolean(),
            SortOrder = doc.Contains("SortOrder") ? doc["SortOrder"].AsInt() : 0,
            IsBestValue = doc.Contains("IsBestValue") && doc["IsBestValue"].AsBoolean(),
            StripePriceId = doc.Contains("StripePriceId") ? doc["StripePriceId"].AsString() : null,
            UpdatedAt = doc.Contains("UpdatedAt") && DateTime.TryParse(doc["UpdatedAt"].AsString(), out var u) ? u : DateTime.UtcNow,
        };
    }

    public async Task<IReadOnlyList<CreditTransactionAuditDto>> ListRecentTransactionsForUserAsync(string userId, int limit = 50)
    {
        limit = Math.Clamp(limit, 1, 200);
        var rows = new List<CreditTransactionAuditDto>();
        Dictionary<string, AttributeValue>? startKey = null;
        try
        {
            do
            {
                var resp = await _dynamoDb.ScanAsync(new ScanRequest
                {
                    TableName = CreditTransactionsTable,
                    ExclusiveStartKey = startKey,
                    Limit = 80,
                });
                foreach (var item in resp.Items)
                {
                    if (!item.TryGetValue("UserId", out var uid) || uid.S != userId)
                        continue;
                    rows.Add(MapTxAudit(item));
                }
                startKey = resp.LastEvaluatedKey is { Count: > 0 } ? resp.LastEvaluatedKey : null;
            } while (startKey != null && rows.Count < limit * 4);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "ListRecentTransactionsForUser {UserId}", userId);
        }

        return rows
            .OrderByDescending(r => r.CreatedAt)
            .Take(limit)
            .ToList();
    }

    private static CreditTransactionAuditDto MapTxAudit(Dictionary<string, AttributeValue> item)
    {
        static int? TryInt(AttributeValue? v)
        {
            if (v == null) return null;
            if (v.N != null && int.TryParse(v.N, NumberStyles.Integer, CultureInfo.InvariantCulture, out var i)) return i;
            return null;
        }
        var id = item.TryGetValue("Id", out var idv) ? idv.S ?? "" : "";
        var type = item.TryGetValue("Type", out var tv) ? tv.S ?? "" : "";
        var reason = item.TryGetValue("Reason", out var rv) ? rv.S ?? "" : "";
        var delta = item.TryGetValue("CreditsDelta", out var dv) && dv.N != null && int.TryParse(dv.N, NumberStyles.Integer, CultureInfo.InvariantCulture, out var di) ? di : 0;
        var refId = item.TryGetValue("RefId", out var refv) ? refv.S : null;
        var created = DateTime.UtcNow;
        if (item.TryGetValue("CreatedAt", out var cv) && DateTime.TryParse(cv.S, CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind, out var parsed))
            created = parsed.ToUniversalTime();
        item.TryGetValue("BalanceBefore", out var bb);
        item.TryGetValue("BalanceAfter", out var ba);
        return new CreditTransactionAuditDto
        {
            Id = id,
            Type = type,
            CreditsDelta = delta,
            Reason = reason,
            RefId = refId,
            CreatedAt = created,
            BalanceBefore = TryInt(bb),
            BalanceAfter = TryInt(ba),
        };
    }

    public async Task<CreditsBalanceDto> ActivateProfileBoost24hAsync(string userId)
    {
        await SpendCreditsAsync(userId, CreditRules.ProfileBoost24h, CreditLedgerReason.ProfileBoost24h, null, idempotent: false);
        var userTable = Table.LoadTable(_dynamoDb, UserCreditsTable);
        var doc = await userTable.GetItemAsync(userId) ?? throw new InvalidOperationException("User credits row missing after spend.");
        var balance = doc.Contains("Balance") ? doc["Balance"].AsInt() : 0;
        var lifetimeEarned = doc.Contains("LifetimeEarned") ? doc["LifetimeEarned"].AsInt() : 0;
        var now = DateTime.UtcNow;
        DateTime end;
        if (doc.Contains("BoostExpiresAtUtc") && DateTime.TryParse(doc["BoostExpiresAtUtc"].AsString(), CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind, out var existing) && existing.ToUniversalTime() > now)
            end = existing.ToUniversalTime().AddHours(24);
        else
            end = now.AddHours(24);
        var next = BuildUserCreditsPutDocument(userId, balance, lifetimeEarned, doc);
        next["BoostExpiresAtUtc"] = end.ToString("O");
        await userTable.PutItemAsync(next);
        _logger.LogInformation("[PremiumAction] profile_boost_24h user={UserId} until {End}", userId, end);
        return await GetCreditsBalanceAsync(userId);
    }

    public async Task<CreditsBalanceDto> UnlockRevealLikesAsync(string userId)
    {
        var cur = await GetCreditsBalanceAsync(userId);
        if (cur.RevealLikesUnlocked)
        {
            _logger.LogInformation("Reveal likes already unlocked for {UserId}", userId);
            return cur;
        }

        await SpendCreditsAsync(userId, CreditRules.RevealLikes, CreditLedgerReason.RevealLikes, $"reveal_likes:{userId}", idempotent: true);
        var userTable = Table.LoadTable(_dynamoDb, UserCreditsTable);
        var doc = await userTable.GetItemAsync(userId) ?? throw new InvalidOperationException("User credits row missing after spend.");
        var balance = doc.Contains("Balance") ? doc["Balance"].AsInt() : 0;
        var lifetimeEarned = doc.Contains("LifetimeEarned") ? doc["LifetimeEarned"].AsInt() : 0;
        var next = BuildUserCreditsPutDocument(userId, balance, lifetimeEarned, doc);
        next["RevealLikesUnlockedAt"] = DateTime.UtcNow.ToString("O");
        await userTable.PutItemAsync(next);
        _logger.LogInformation("[PremiumAction] reveal_likes user={UserId}", userId);
        return await GetCreditsBalanceAsync(userId);
    }
}
