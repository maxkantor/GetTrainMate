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

        var detailType = request.TryGetProperty("detail-type", out var dt) ? dt.GetString() : null;
        var isDiscovery = string.Equals(detailType, "partner-outreach-discovery", StringComparison.OrdinalIgnoreCase);

        var webHost = Microsoft.AspNetCore.WebHost.CreateDefaultBuilder()
            .UseContentRoot(Directory.GetCurrentDirectory())
            .UseStartup<Startup>()
            .Build();
        await webHost.StartAsync();
        try
        {
            using var scope = webHost.Services.CreateScope();
            if (isDiscovery)
            {
                var discovery = scope.ServiceProvider.GetRequiredService<AutomatedMarketDiscoveryService>();
                var outreach = scope.ServiceProvider.GetRequiredService<IPartnerOutreachService>();
                var settingsObj = await outreach.GetOutreachSettingsAsync();
                var t = settingsObj.GetType();
                int ReadInt(string name, int fallback)
                {
                    var v = t.GetProperty(name)?.GetValue(settingsObj)
                        ?? t.GetProperty(ToPascal(name))?.GetValue(settingsObj);
                    // anonymous settings use camelCase via reflection on generated properties
                    if (v == null)
                    {
                        foreach (var p in t.GetProperties())
                        {
                            if (string.Equals(p.Name, name, StringComparison.OrdinalIgnoreCase))
                            {
                                v = p.GetValue(settingsObj);
                                break;
                            }
                        }
                    }
                    return v is int i && i > 0 ? i : fallback;
                }
                bool ReadBool(string name)
                {
                    foreach (var p in t.GetProperties())
                    {
                        if (!string.Equals(p.Name, name, StringComparison.OrdinalIgnoreCase)) continue;
                        return p.GetValue(settingsObj) is true;
                    }
                    return false;
                }
                static string ToPascal(string name) =>
                    string.IsNullOrEmpty(name) ? name : char.ToUpperInvariant(name[0]) + name[1..];

                var maxProspects = ReadInt("ProspectsPerRun", 8);
                if (ReadBool("KeepPipelineFull"))
                {
                    var counters = await outreach.GetPipelineCountersAsync();
                    var ct = counters.GetType();
                    int eligible = 0, target = 200;
                    foreach (var p in ct.GetProperties())
                    {
                        if (string.Equals(p.Name, "eligibleUnsent", StringComparison.OrdinalIgnoreCase)
                            && p.GetValue(counters) is int e) eligible = e;
                        if (string.Equals(p.Name, "targetProspectInventory", StringComparison.OrdinalIgnoreCase)
                            && p.GetValue(counters) is int tg && tg > 0) target = tg;
                    }
                    var deficit = Math.Max(0, target - eligible);
                    if (deficit > 0)
                        maxProspects = Math.Max(maxProspects, Math.Min(deficit, 40));
                }

                return await discovery.RunLimitedAsync(
                    maxProspects: maxProspects,
                    maxResearchAttempts: ReadInt("ResearchAttemptsPerRun", 15),
                    maxDrafts: ReadInt("DraftsPerRun", 5),
                    prepareDrafts: true);
            }
            var svc = scope.ServiceProvider.GetRequiredService<IPartnerOutreachService>();
            return await svc.RunAutomaticAcquisitionAsync("eventbridge");
        }
        finally
        {
            await webHost.StopAsync();
            webHost.Dispose();
        }
    }
}
