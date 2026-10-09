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
/// HTTP API v2 (API Gateway) plus EventBridge daily partner dispatch.
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

        // SES configuration-set events via SNS → Lambda (IAM-authenticated; not public HTTP).
        if (PartnerSesEventProcessor.IsSnsEnvelope(request))
        {
            var parsed = PartnerSesEventProcessor.ParseSnsLambdaEvent(request);
            if (parsed.Count == 0)
                return new { ok = true, applied = 0, note = "no_actionable_ses_events" };

            var webHostSes = Microsoft.AspNetCore.WebHost.CreateDefaultBuilder()
                .UseContentRoot(Directory.GetCurrentDirectory())
                .UseStartup<Startup>()
                .Build();
            await webHostSes.StartAsync();
            try
            {
                using var scope = webHostSes.Services.CreateScope();
                var svc = scope.ServiceProvider.GetRequiredService<IPartnerOutreachService>();
                var applied = 0;
                foreach (var (internalId, eventType, _) in parsed)
                {
                    await svc.ApplySesEventAsync(internalId, eventType);
                    applied++;
                    context.Logger.LogLine(
                        $"partner_ses_event applied internalId={internalId} eventType={eventType}");
                }
                return new { ok = true, applied };
            }
            finally
            {
                await webHostSes.StopAsync();
                webHostSes.Dispose();
            }
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

                int ReadIntAllowZero(string name, int fallback)
                {
                    foreach (var p in t.GetProperties())
                    {
                        if (!string.Equals(p.Name, name, StringComparison.OrdinalIgnoreCase)) continue;
                        if (p.GetValue(settingsObj) is int i && i >= 0) return i;
                    }
                    return fallback;
                }

                var maxProspects = ReadInt("ProspectsPerRun", 8);
                var startMarket = ReadIntAllowZero("LastDiscoveryMarketCursor", 0);
                if (ReadBool("KeepPipelineFull"))
                {
                    var counters = await outreach.GetPipelineCountersAsync();
                    var ct = counters.GetType();
                    int eligible = 0, target = 200, lowWatermark = 100, ready = 0;
                    foreach (var p in ct.GetProperties())
                    {
                        if (string.Equals(p.Name, "eligibleUnsent", StringComparison.OrdinalIgnoreCase)
                            && p.GetValue(counters) is int e) eligible = e;
                        if (string.Equals(p.Name, "readyInventory", StringComparison.OrdinalIgnoreCase)
                            && p.GetValue(counters) is int r) ready = r;
                        if (string.Equals(p.Name, "targetProspectInventory", StringComparison.OrdinalIgnoreCase)
                            && p.GetValue(counters) is int tg && tg > 0) target = tg;
                        if (string.Equals(p.Name, "discoveryLowWatermark", StringComparison.OrdinalIgnoreCase)
                            && p.GetValue(counters) is int lw && lw > 0) lowWatermark = lw;
                    }
                    if (ready <= 0) ready = eligible;
                    var deficit = Math.Max(0, target - ready);
                    if (ready < lowWatermark || deficit > 0)
                        maxProspects = Math.Max(maxProspects, Math.Min(Math.Max(deficit, 12), 40));
                }

                var report = await discovery.RunLimitedAsync(
                    maxProspects: maxProspects,
                    maxResearchAttempts: 0, // inventory first; contact research is a separate path
                    maxDrafts: ReadInt("DraftsPerRun", 5),
                    prepareDrafts: false,
                    startMarketIndex: startMarket);

                try
                {
                    await outreach.UpdateOutreachSettingsAsync(new Models.PartnerOutreachSettingsPatch
                    {
                        LastDiscoveryMarketCursor = report.NextMarketIndex,
                    });
                }
                catch { /* best-effort cursor persist */ }

                return report;
            }
            var svc = scope.ServiceProvider.GetRequiredService<IPartnerOutreachService>();
            bool? dryRun = null;
            if (request.TryGetProperty("dryRun", out var dr))
                dryRun = dr.ValueKind == JsonValueKind.True || string.Equals(dr.GetString(), "true", StringComparison.OrdinalIgnoreCase);
            return await svc.RunAutomaticAcquisitionAsync("eventbridge", dryRun, budgetSeconds: 70);
        }
        finally
        {
            await webHost.StopAsync();
            webHost.Dispose();
        }
    }
}
