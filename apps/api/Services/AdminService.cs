using Amazon.DynamoDBv2.DataModel;
using Amazon.DynamoDBv2.DocumentModel;
using System.Security.Cryptography;
using System.Text;
using GetTrainMate.Api.Models;

namespace GetTrainMate.Api.Services;

public interface IAdminService
{
    Task<AdminUser> InitializeAdminAsync(string email, string name);
    Task<AdminTokenResponse> LoginAsync(string email, string password);
    Task<AdminUser> GetAdminAsync(string adminId);
    Task<bool> VerifyAdminPasswordAsync(string email, string password);
    Task UpdateAdminAsync(AdminUser admin);
    Task<AdminUser> ValidateAdminTokenAsync(string token, TimeSpan? maxAge = null);
}

public class AdminService : IAdminService
{
    private readonly IDynamoDBContext _context;
    private readonly ISecretsService _secretsService;
    private readonly ILogger<AdminService> _logger;
    private const string ADMIN_PASSWORD_SSM_KEY = "/gettrainmate/admin/password";

    public AdminService(
        IDynamoDBContext context,
        ISecretsService secretsService,
        ILogger<AdminService> logger)
    {
        _context = context;
        _secretsService = secretsService;
        _logger = logger;
    }

    public async Task<AdminUser> InitializeAdminAsync(string email, string name)
    {
        try
        {
            // Check if admin already exists
            var existingAdmins = await _context.QueryAsync<AdminUser>(email).GetRemainingAsync();
            if (existingAdmins.Count > 0)
            {
                _logger.LogWarning($"Admin user already exists: {email}");
                return existingAdmins.First();
            }

            // Check if password is already stored
            var passwordExists = await _secretsService.SecretExistsAsync(ADMIN_PASSWORD_SSM_KEY);
            string password;

            if (passwordExists)
            {
                password = await _secretsService.GetSecretAsync(ADMIN_PASSWORD_SSM_KEY);
                _logger.LogInformation("Using existing admin password from SSM");
            }
            else
            {
                // Generate a secure random password (16 characters)
                password = GenerateSecurePassword(16);
                await _secretsService.SetSecretAsync(
                    ADMIN_PASSWORD_SSM_KEY,
                    password,
                    "GetTrainMate Admin Initial Password"
                );
                _logger.LogInformation("Generated and stored new admin password in SSM");
            }

            // Create admin user
            var admin = new AdminUser
            {
                AdminId = Guid.NewGuid().ToString(),
                Email = email,
                Name = name,
                Permissions = new List<string> { "content_management", "user_management", "analytics", "settings" },
                IsActive = true
            };

            await _context.SaveAsync(admin);
            _logger.LogInformation($"Initialized admin user: {email}");

            return admin;
        }
        catch (Exception ex)
        {
            _logger.LogError($"Error initializing admin: {ex.Message}");
            throw;
        }
    }

    public async Task<AdminTokenResponse> LoginAsync(string email, string password)
    {
        try
        {
            // Verify password
            var isValid = await VerifyAdminPasswordAsync(email, password);
            if (!isValid)
                throw new UnauthorizedAccessException("Invalid credentials");

            // Get admin user
            var admins = await _context.QueryAsync<AdminUser>(email).GetRemainingAsync();
            var admin = admins.FirstOrDefault();

            if (admin == null || !admin.IsActive)
                throw new UnauthorizedAccessException("Admin user not found or inactive");

            // Update last login
            admin.LastLoginAt = DateTime.UtcNow;
            await _context.SaveAsync(admin);

            // Generate token (simple JWT-like token for now)
            var token = GenerateAdminToken(admin);

            _logger.LogInformation($"Admin login successful: {email}");

            return new AdminTokenResponse
            {
                Token = token,
                Admin = new AdminUserDto
                {
                    AdminId = admin.AdminId,
                    Email = admin.Email,
                    Name = admin.Name,
                    Permissions = admin.Permissions,
                    IsActive = admin.IsActive
                }
            };
        }
        catch (Exception ex)
        {
            _logger.LogError($"Error during admin login: {ex.Message}");
            throw;
        }
    }

    public async Task<AdminUser> GetAdminAsync(string adminId)
    {
        try
        {
            var search = _context.ScanAsync<AdminUser>(new List<ScanCondition>
            {
                new ScanCondition(nameof(AdminUser.AdminId), ScanOperator.Equal, adminId)
            });

            var admins = await search.GetRemainingAsync();
            var admin = admins.FirstOrDefault();

            return admin ?? throw new KeyNotFoundException($"Admin {adminId} not found");
        }
        catch (Exception ex)
        {
            _logger.LogError($"Error retrieving admin: {ex.Message}");
            throw;
        }
    }

    public async Task<AdminUser> ValidateAdminTokenAsync(string token, TimeSpan? maxAge = null)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(token))
                throw new UnauthorizedAccessException("Missing admin token");

            var decoded = Encoding.UTF8.GetString(Convert.FromBase64String(token));
            var parts = decoded.Split(':');

            if (parts.Length != 3)
                throw new UnauthorizedAccessException("Invalid admin token format");

            var adminId = parts[0];
            var email = parts[1];
            if (!long.TryParse(parts[2], out var timestamp))
                throw new UnauthorizedAccessException("Invalid admin token timestamp");

            var issuedAt = DateTimeOffset.FromUnixTimeSeconds(timestamp);
            var maxTokenAge = maxAge ?? TimeSpan.FromDays(30);
            if (DateTimeOffset.UtcNow - issuedAt > maxTokenAge)
                throw new UnauthorizedAccessException("Admin token expired");

            var admin = await _context.LoadAsync<AdminUser>(email, adminId);
            if (admin == null || !admin.IsActive)
                throw new UnauthorizedAccessException("Admin not found or inactive");

            return admin;
        }
        catch (FormatException ex)
        {
            _logger.LogWarning($"Invalid admin token format: {ex.Message}");
            throw new UnauthorizedAccessException("Invalid admin token");
        }
        catch (UnauthorizedAccessException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError($"Error validating admin token: {ex.Message}");
            throw new UnauthorizedAccessException("Invalid admin token");
        }
    }

    public async Task<bool> VerifyAdminPasswordAsync(string email, string password)
    {
        try
        {
            var storedPassword = await _secretsService.GetSecretAsync(ADMIN_PASSWORD_SSM_KEY);
            return password == storedPassword;
        }
        catch (KeyNotFoundException)
        {
            _logger.LogWarning("Admin password not found in SSM");
            return false;
        }
        catch (Exception ex)
        {
            _logger.LogError($"Error verifying password: {ex.Message}");
            return false;
        }
    }

    public async Task UpdateAdminAsync(AdminUser admin)
    {
        try
        {
            await _context.SaveAsync(admin);
            _logger.LogInformation($"Updated admin: {admin.Email}");
        }
        catch (Exception ex)
        {
            _logger.LogError($"Error updating admin: {ex.Message}");
            throw;
        }
    }

    private string GenerateSecurePassword(int length)
    {
        const string validChars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
        using (var rng = new RNGCryptoServiceProvider())
        {
            var byteBuffer = new byte[length];
            rng.GetBytes(byteBuffer);

            var charsBuffer = new StringBuilder(length);
            foreach (byte b in byteBuffer)
                charsBuffer.Append(validChars[b % validChars.Length]);

            return charsBuffer.ToString();
        }
    }

    private string GenerateAdminToken(AdminUser admin)
    {
        // Simple token format: adminId:email:timestamp
        var timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        var tokenData = $"{admin.AdminId}:{admin.Email}:{timestamp}";
        var tokenBytes = Encoding.UTF8.GetBytes(tokenData);
        return Convert.ToBase64String(tokenBytes);
    }
}
