using System.Text;
using System.Text.Json;
using Amazon.Lambda.APIGatewayEvents;
using Amazon.Lambda.AspNetCoreServer;
using Amazon.Lambda.Core;
using Amazon.Lambda.Serialization.SystemTextJson;
using GetTrainMate.Api.Services.PartnerOutreach;
using Microsoft.Extensions.DependencyInjection;

namespace GetTrainMate.Api;

/// <summary>
/// HTTP API v2 (API Gateway) plus EventBridge weekday partner dispatch.
/// </summary>
public class LambdaEntryPoint : APIGatewayHttpApiV2ProxyFunction
{
    protected override void Init(IWebHostBuilder builder)
    {
        builder
            .UseContentRoot(Directory.GetCurrentDirectory())
            .UseStartup<Startup>();
    }

    /// <summary>
    /// Routes API Gateway proxy events to ASP.NET and EventBridge/Scheduler ticks to CRM dispatch.
    /// </summary>
    public async Task<object> HandleAwsEventAsync(JsonElement request, ILambdaContext context)
    {
        if (request.ValueKind == JsonValueKind.Object && request.TryGetProperty("requestContext", out _))
        {
            // Must use the Lambda serializer (case-insensitive AWS event names). Plain
            // System.Text.Json leaves RequestContext/Http null and MarshallRequest NREs.
            var serializer = new DefaultLambdaJsonSerializer();
            using var ms = new MemoryStream(Encoding.UTF8.GetBytes(request.GetRawText()));
            var proxy = serializer.Deserialize<APIGatewayHttpApiV2ProxyRequest>(ms)
                ?? throw new InvalidOperationException("Invalid API Gateway event");
            return await FunctionHandlerAsync(proxy, context);
        }

        var webHost = Microsoft.AspNetCore.WebHost.CreateDefaultBuilder()
            .UseContentRoot(Directory.GetCurrentDirectory())
            .UseStartup<Startup>()
            .Build();
        await webHost.StartAsync();
        try
        {
            using var scope = webHost.Services.CreateScope();
            var svc = scope.ServiceProvider.GetRequiredService<IPartnerOutreachService>();
            return await svc.DispatchDueAsync(scheduledCursorAutomation: false);
        }
        finally
        {
            await webHost.StopAsync();
            webHost.Dispose();
        }
    }
}
