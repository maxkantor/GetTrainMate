using Xunit;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Moq;
using GetTrainMate.Api.Services;

namespace GetTrainMate.Api.Tests;

public class AdminAuthorizationServiceTests
{
    private readonly Mock<IConfiguration> _mockConfig;
    private readonly Mock<ILogger<AdminAuthorizationService>> _mockLogger;
    private readonly AdminAuthorizationService _service;

    public AdminAuthorizationServiceTests()
    {
        _mockConfig = new Mock<IConfiguration>();
        _mockLogger = new Mock<ILogger<AdminAuthorizationService>>();
        
        // Set default allowlist
        Environment.SetEnvironmentVariable("ADMIN_ALLOWLIST", "mykantor@bellsouth.net,admin@test.com");
        
        _service = new AdminAuthorizationService(_mockConfig.Object, _mockLogger.Object);
    }

    [Fact]
    public void IsInAllowlist_ShouldReturnTrue_WhenEmailMatches()
    {
        // Arrange
        var email = "mykantor@bellsouth.net";

        // Act
        var result = _service.IsInAllowlist(null, null, email);

        // Assert
        Assert.True(result);
    }

    [Fact]
    public void IsInAllowlist_ShouldReturnTrue_WhenSubMatches()
    {
        // Arrange
        var sub = "mykantor@bellsouth.net";

        // Act
        var result = _service.IsInAllowlist(sub, null, null);

        // Assert
        Assert.True(result);
    }

    [Fact]
    public void IsInAllowlist_ShouldReturnFalse_WhenNotInAllowlist()
    {
        // Arrange
        var email = "notadmin@example.com";

        // Act
        var result = _service.IsInAllowlist(null, null, email);

        // Assert
        Assert.False(result);
    }

    [Fact]
    public void IsInAllowlist_ShouldBeCaseInsensitive()
    {
        // Arrange
        var email = "MYKANTOR@BELLSOUTH.NET";

        // Act
        var result = _service.IsInAllowlist(null, null, email);

        // Assert
        Assert.True(result);
    }

    [Fact]
    public void IsInAllowlist_ShouldHandleMultipleEntries()
    {
        // Arrange
        var email = "admin@test.com";

        // Act
        var result = _service.IsInAllowlist(null, null, email);

        // Assert
        Assert.True(result);
    }
}
