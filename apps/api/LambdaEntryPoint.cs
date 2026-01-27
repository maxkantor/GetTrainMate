using Amazon.Lambda.AspNetCoreServer;
using Microsoft.AspNetCore.Hosting;

namespace GetTrainMate.Api;

public class LambdaEntryPoint : APIGatewayHttpApiV2ProxyFunction
{
    protected override void Init(IWebHostBuilder builder)
    {
        builder
            .UseContentRoot(Directory.GetCurrentDirectory())
            .UseStartup<Startup>();
    }
}

public class Startup
{
    public void ConfigureServices(IServiceCollection services)
    {
        // Services are configured in Program.cs
    }

    public void Configure(IApplicationBuilder app, IWebHostEnvironment env)
    {
        // Configuration is done in Program.cs
    }
}
