using Amazon.SimpleSystemsManagement;
using Amazon.SimpleSystemsManagement.Model;
using GetTrainMate.Api.Models;

namespace GetTrainMate.Api.Services;

public interface ISecretsService
{
    Task<string> GetSecretAsync(string parameterName);
    Task SetSecretAsync(string parameterName, string value, string description = "");
    Task<bool> SecretExistsAsync(string parameterName);
    Task DeleteSecretAsync(string parameterName);
}

public class SecretsService : ISecretsService
{
    private readonly IAmazonSimpleSystemsManagement _ssmClient;
    private readonly ILogger<SecretsService> _logger;

    public SecretsService(IAmazonSimpleSystemsManagement ssmClient, ILogger<SecretsService> logger)
    {
        _ssmClient = ssmClient;
        _logger = logger;
    }

    public async Task<string> GetSecretAsync(string parameterName)
    {
        try
        {
            var request = new GetParameterRequest
            {
                Name = parameterName,
                WithDecryption = true
            };

            var response = await _ssmClient.GetParameterAsync(request);
            _logger.LogInformation($"Retrieved secret: {parameterName}");
            return response.Parameter.Value;
        }
        catch (AmazonSimpleSystemsManagementException ex) when (ex.ErrorCode == "ParameterNotFound")
        {
            _logger.LogWarning($"Secret not found: {parameterName}");
            throw new KeyNotFoundException($"Secret '{parameterName}' not found in Parameter Store");
        }
        catch (Exception ex)
        {
            _logger.LogError($"Error retrieving secret {parameterName}: {ex.Message}");
            throw;
        }
    }

    public async Task SetSecretAsync(string parameterName, string value, string description = "")
    {
        try
        {
            var request = new PutParameterRequest
            {
                Name = parameterName,
                Value = value,
                Type = ParameterType.SecureString,
                Description = description,
                Overwrite = true,
                Tier = ParameterTier.Standard
            };

            await _ssmClient.PutParameterAsync(request);
            _logger.LogInformation($"Stored secret: {parameterName}");
        }
        catch (Exception ex)
        {
            _logger.LogError($"Error storing secret {parameterName}: {ex.Message}");
            throw;
        }
    }

    public async Task<bool> SecretExistsAsync(string parameterName)
    {
        try
        {
            await GetSecretAsync(parameterName);
            return true;
        }
        catch (KeyNotFoundException)
        {
            return false;
        }
    }

    public async Task DeleteSecretAsync(string parameterName)
    {
        try
        {
            var request = new DeleteParameterRequest { Name = parameterName };
            await _ssmClient.DeleteParameterAsync(request);
            _logger.LogInformation($"Deleted secret: {parameterName}");
        }
        catch (Exception ex)
        {
            _logger.LogError($"Error deleting secret {parameterName}: {ex.Message}");
            throw;
        }
    }
}
