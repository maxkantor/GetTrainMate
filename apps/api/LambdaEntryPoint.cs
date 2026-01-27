using Amazon.Lambda.AspNetCoreServer.Hosting;
using Microsoft.AspNetCore.Hosting;

namespace GetTrainMate.Api;

public class LambdaEntryPoint : APIGatewayHttpApiV2ProxyFunction
{
    protected override void Init(IWebHostBuilder builder)
    {
        builder
            .UseContentRoot(Directory.GetCurrentDirectory())
            .UseLambdaServer();
    }
}
