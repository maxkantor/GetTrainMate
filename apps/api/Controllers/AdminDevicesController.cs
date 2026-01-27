using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using GetTrainMate.Api.Models;
using GetTrainMate.Api.Services;
using Amazon.DynamoDBv2.DataModel;
using System.Security.Claims;
using Amazon.DynamoDBv2;

namespace GetTrainMate.Api.Controllers;

[ApiController]
[Route("api/admin/users/{userId}/devices")]
[Authorize]
public class AdminDevicesController : ControllerBase
{
    private readonly IDynamoDBContext _context;
    private readonly IAuditLogService _auditLogService;
    private readonly ILogger<AdminDevicesController> _logger;

    public AdminDevicesController(
        IDynamoDBContext context,
        IAuditLogService auditLogService,
        ILogger<AdminDevicesController> logger)
    {
        _context = context;
        _auditLogService = auditLogService;
        _logger = logger;
    }

    private AdminIdentity GetAdminIdentity()
    {
        if (HttpContext.Items["AdminIdentity"] is AdminIdentity identity)
        {
            return identity;
        }
        
        var sub = User.FindFirst(ClaimTypes.NameIdentifier)?.Value 
            ?? User.FindFirst("sub")?.Value 
            ?? throw new UnauthorizedAccessException("Admin identity not found");
        
        return new AdminIdentity
        {
            Sub = sub,
            CognitoUsername = User.FindFirst("cognito:username")?.Value,
            Email = User.FindFirst(ClaimTypes.Email)?.Value ?? User.FindFirst("email")?.Value
        };
    }

    /// <summary>
    /// GET /api/admin/users/{userId}/devices
    /// Get user's devices and tokens
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<DevicesResponse>> GetDevices(string userId)
    {
        try
        {
            // TODO: Implement device listing
            return Ok(new DevicesResponse
            {
                Devices = new List<DeviceInfo>(),
                TokenBalance = 0,
                TokenLedger = new List<LedgerEntry>()
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting devices for user {UserId}", userId);
            return StatusCode(500, new { error = "Failed to get devices" });
        }
    }

    /// <summary>
    /// POST /api/admin/users/{userId}/tokens/add
    /// Add tokens to user wallet
    /// </summary>
    [HttpPost("tokens/add")]
    public async Task<ActionResult> AddTokens(string userId, [FromBody] AddTokensRequest request)
    {
        try
        {
            var admin = GetAdminIdentity();
            
            // TODO: Implement token addition
            // 1. Get user wallet
            // 2. Add tokens
            // 3. Create ledger entry
            // 4. Log audit
            
            await _auditLogService.LogActionAsync(
                admin,
                "token.add",
                "token",
                userId,
                after: new { amount = request.Amount, reason = request.Reason });

            return Ok(new { message = "Tokens added successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error adding tokens for user {UserId}", userId);
            return StatusCode(500, new { error = "Failed to add tokens" });
        }
    }

    /// <summary>
    /// POST /api/admin/users/{userId}/tokens/remove
    /// Remove tokens from user wallet
    /// </summary>
    [HttpPost("tokens/remove")]
    public async Task<ActionResult> RemoveTokens(string userId, [FromBody] RemoveTokensRequest request)
    {
        try
        {
            var admin = GetAdminIdentity();
            
            // TODO: Implement token removal
            
            await _auditLogService.LogActionAsync(
                admin,
                "token.remove",
                "token",
                userId,
                after: new { amount = request.Amount, reason = request.Reason });

            return Ok(new { message = "Tokens removed successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error removing tokens for user {UserId}", userId);
            return StatusCode(500, new { error = "Failed to remove tokens" });
        }
    }

    /// <summary>
    /// POST /api/admin/users/{userId}/tokens/reset-device
    /// Reset device tokens
    /// </summary>
    [HttpPost("tokens/reset-device")]
    public async Task<ActionResult> ResetDevice(string userId, [FromBody] ResetDeviceRequest request)
    {
        try
        {
            var admin = GetAdminIdentity();
            
            // TODO: Implement device reset
            
            await _auditLogService.LogActionAsync(
                admin,
                "token.reset-device",
                "device",
                userId,
                after: new { deviceIds = request.DeviceIds, reason = request.Reason });

            return Ok(new { message = "Device reset successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error resetting device for user {UserId}", userId);
            return StatusCode(500, new { error = "Failed to reset device" });
        }
    }

    /// <summary>
    /// POST /api/admin/users/{userId}/tokens/revoke-device
    /// Revoke a device
    /// </summary>
    [HttpPost("tokens/revoke-device")]
    public async Task<ActionResult> RevokeDevice(string userId, [FromBody] RevokeDeviceRequest request)
    {
        try
        {
            var admin = GetAdminIdentity();
            
            // TODO: Implement device revocation
            
            await _auditLogService.LogActionAsync(
                admin,
                "token.revoke-device",
                "device",
                userId,
                after: new { deviceId = request.DeviceId, reason = request.Reason });

            return Ok(new { message = "Device revoked successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error revoking device for user {UserId}", userId);
            return StatusCode(500, new { error = "Failed to revoke device" });
        }
    }

    /// <summary>
    /// POST /api/admin/users/{userId}/tokens/merge-by-email
    /// Merge wallets by Stripe email (CRITICAL)
    /// </summary>
    [HttpPost("tokens/merge-by-email")]
    public async Task<ActionResult<MergeWalletsResponse>> MergeByEmail(string userId, [FromBody] MergeByEmailRequest request)
    {
        try
        {
            var admin = GetAdminIdentity();
            var email = request.Email.ToLowerInvariant();
            
            // 1. Find Stripe customer by email
            var stripeCustomers = await _context.QueryAsync<StripeCustomer>(
                email,
                new DynamoDBOperationConfig { IndexName = "email-index" })
                .GetRemainingAsync();

            string? stripeCustomerId = null;
            if (stripeCustomers.Any())
            {
                stripeCustomerId = stripeCustomers.First().StripeCustomerId;
            }

            // 2. Find all wallets linked to that email
            var wallets = await _context.QueryAsync<TokenWallet>(
                email,
                new DynamoDBOperationConfig { IndexName = "email-index" })
                .GetRemainingAsync();

            if (!wallets.Any())
            {
                return BadRequest(new { error = "No wallets found for this email" });
            }

            // 3. Choose primary wallet (most recently active or primaryWallet=true)
            var primaryWallet = wallets.FirstOrDefault(w => w.IsPrimary && w.MergedInto == null)
                ?? wallets.OrderByDescending(w => w.LastActive).First();

            var secondaryWallets = wallets.Where(w => w.WalletId != primaryWallet.WalletId && w.MergedInto == null).ToList();

            if (!secondaryWallets.Any())
            {
                return Ok(new MergeWalletsResponse
                {
                    PrimaryWalletId = primaryWallet.WalletId,
                    MergedWallets = new List<string>(),
                    TotalTokensMerged = 0,
                    Message = "No secondary wallets to merge"
                });
            }

            // 4. Move balances from secondary → primary
            int totalTokensMerged = 0;
            var mergedWalletIds = new List<string>();

            foreach (var secondaryWallet in secondaryWallets)
            {
                if (secondaryWallet.TokenBalance <= 0)
                {
                    continue; // Skip wallets with no balance
                }

                var balanceBeforePrimary = primaryWallet.TokenBalance;
                var balanceBeforeSecondary = secondaryWallet.TokenBalance;

                // Transfer tokens
                totalTokensMerged += secondaryWallet.TokenBalance;
                primaryWallet.TokenBalance += secondaryWallet.TokenBalance;
                secondaryWallet.TokenBalance = 0;
                secondaryWallet.MergedInto = primaryWallet.WalletId;
                secondaryWallet.UpdatedAt = DateTime.UtcNow;

                // 5. Create ledger entries
                var mergeOutEntry = new TokenLedgerEntry
                {
                    EntryId = Guid.NewGuid().ToString(),
                    Timestamp = DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffZ"),
                    WalletId = secondaryWallet.WalletId,
                    Type = "MERGE_OUT",
                    Amount = balanceBeforeSecondary,
                    BalanceBefore = balanceBeforeSecondary,
                    BalanceAfter = 0,
                    Reason = request.Reason ?? $"Merged into wallet {primaryWallet.WalletId}",
                    AdminSub = admin.Sub,
                    RelatedWalletId = primaryWallet.WalletId
                };

                var mergeInEntry = new TokenLedgerEntry
                {
                    EntryId = Guid.NewGuid().ToString(),
                    Timestamp = DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffZ"),
                    WalletId = primaryWallet.WalletId,
                    Type = "MERGE_IN",
                    Amount = balanceBeforeSecondary,
                    BalanceBefore = balanceBeforePrimary,
                    BalanceAfter = primaryWallet.TokenBalance,
                    Reason = request.Reason ?? $"Merged from wallet {secondaryWallet.WalletId}",
                    AdminSub = admin.Sub,
                    RelatedWalletId = secondaryWallet.WalletId
                };

                await _context.SaveAsync(secondaryWallet);
                await _context.SaveAsync(mergeOutEntry);
                await _context.SaveAsync(mergeInEntry);

                mergedWalletIds.Add(secondaryWallet.WalletId);
            }

            // Update primary wallet
            primaryWallet.IsPrimary = true;
            primaryWallet.UpdatedAt = DateTime.UtcNow;
            if (!string.IsNullOrEmpty(stripeCustomerId))
            {
                primaryWallet.StripeCustomerId = stripeCustomerId;
            }
            await _context.SaveAsync(primaryWallet);

            // 7. Update Stripe customer mapping to primary wallet
            if (!string.IsNullOrEmpty(stripeCustomerId))
            {
                var stripeCustomer = stripeCustomers.First();
                stripeCustomer.WalletId = primaryWallet.WalletId;
                stripeCustomer.UpdatedAt = DateTime.UtcNow;
                await _context.SaveAsync(stripeCustomer);
            }

            await _auditLogService.LogActionAsync(
                admin,
                "token.merge-by-email",
                "wallet",
                primaryWallet.WalletId,
                after: new 
                { 
                    email = request.Email,
                    primaryWalletId = primaryWallet.WalletId,
                    mergedWallets = mergedWalletIds,
                    totalTokensMerged = totalTokensMerged,
                    reason = request.Reason 
                });

            return Ok(new MergeWalletsResponse
            {
                PrimaryWalletId = primaryWallet.WalletId,
                MergedWallets = mergedWalletIds,
                TotalTokensMerged = totalTokensMerged,
                Message = $"Successfully merged {mergedWalletIds.Count} wallets"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error merging wallets by email for user {UserId}", userId);
            return StatusCode(500, new { error = "Failed to merge wallets", details = ex.Message });
        }
    }
}

// Request/Response models
public class DevicesResponse
{
    public List<DeviceInfo> Devices { get; set; } = new();
    public int TokenBalance { get; set; }
    public List<LedgerEntry> TokenLedger { get; set; } = new();
}

public class DeviceInfo
{
    public string DeviceId { get; set; } = string.Empty;
    public string DeviceName { get; set; } = string.Empty;
    public DateTime LastActive { get; set; }
    public int TokenBalance { get; set; }
    public bool IsPrimary { get; set; }
}

public class LedgerEntry
{
    public string EntryId { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty; // ADD, REMOVE, MERGE_OUT, MERGE_IN, etc.
    public int Amount { get; set; }
    public int BalanceAfter { get; set; }
    public string? Reason { get; set; }
    public DateTime Timestamp { get; set; }
}

public class AddTokensRequest
{
    public int Amount { get; set; }
    public string? Reason { get; set; }
}

public class RemoveTokensRequest
{
    public int Amount { get; set; }
    public string? Reason { get; set; }
}

public class ResetDeviceRequest
{
    public List<string> DeviceIds { get; set; } = new();
    public string? Reason { get; set; }
}

public class RevokeDeviceRequest
{
    public string DeviceId { get; set; } = string.Empty;
    public string? Reason { get; set; }
}

public class MergeByEmailRequest
{
    public string Email { get; set; } = string.Empty;
    public string? Reason { get; set; }
}

public class MergeWalletsResponse
{
    public string PrimaryWalletId { get; set; } = string.Empty;
    public List<string> MergedWallets { get; set; } = new();
    public int TotalTokensMerged { get; set; }
    public string? Message { get; set; }
}
