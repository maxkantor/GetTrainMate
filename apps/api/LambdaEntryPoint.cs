using Amazon.Lambda.AspNetCoreServer;

namespace GetTrainMate.Api;

/// <summary>
/// Lambda entry point for API Gateway HTTP API
/// This class is required by Lambda but the actual configuration is in Program.cs
/// </summary>
public class LambdaEntryPoint : APIGatewayHttpApiV2ProxyFunction
{
    /// <summary>
    /// Initialize the web host builder
    /// </summary>
    protected override void Init(IWebHostBuilder builder)
    {
        builder
            .UseContentRoot(Directory.GetCurrentDirectory())
            .UseStartup<Startup>();
    }
}

