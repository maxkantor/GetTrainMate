using System.Linq;
using Amazon;
using Amazon.CognitoIdentityProvider;
using Amazon.DynamoDBv2;
using Amazon.DynamoDBv2.DataModel;
using Amazon.SimpleSystemsManagement;
using Amazon.SimpleSystemsManagement.Model;
using Amazon.Runtime;
using Amazon.S3;
using GetTrainMate.Api.Configuration;
using GetTrainMate.Api.Services;
using GetTrainMate.Api.Services.Ai;
using GetTrainMate.Api.Services.Bedrock;
using GetTrainMate.Api.Middleware;
using Serilog;
using Stripe;

namespace GetTrainMate.Api;

public class Startup
{
    public IConfiguration Configuration { get; }

    public Startup(IConfiguration configuration)
    {
        Configuration = configuration;
    }

    public void ConfigureServices(IServiceCollection services)
    {
        // Configure Serilog
        Log.Logger = new LoggerConfiguration()
            .MinimumLevel.Debug()
            .WriteTo.Console()
            .CreateLogger();

        // Add AWS services (GetAWSOptions reads "AWS" section; appsettings uses "Aws" — Cognito must match pool region prefix.)
        var awsOptions = Configuration.GetAWSOptions();
        if (awsOptions.Region == null && !string.IsNullOrWhiteSpace(Configuration["Aws:Region"]))
        {
            awsOptions.Region = RegionEndpoint.GetBySystemName(Configuration["Aws:Region"]!.Trim());
        }

        services.AddDefaultAWSOptions(awsOptions);

        CognitoPoolBootstrap.ApplySsmUserPoolIdOverride(Configuration);
        var cognitoRegionName = CognitoRegionResolver.ResolveRegionNameForCognitoClient(Configuration);
        using (var cognitoProbe = new AmazonCognitoIdentityProviderClient(RegionEndpoint.GetBySystemName(cognitoRegionName)))
        {
            CognitoPoolBootstrap.ValidatePoolExistsOrDiagnose(cognitoProbe, cognitoRegionName);
        }

        cognitoRegionName = CognitoRegionResolver.ResolveRegionNameForCognitoClient(Configuration);
        Log.Information(
            "Cognito Identity Provider client region: {Region} (after SSM pool override / optional auto-fix)",
            cognitoRegionName);
        services.AddSingleton<IAmazonCognitoIdentityProvider>(_ =>
            new AmazonCognitoIdentityProviderClient(RegionEndpoint.GetBySystemName(cognitoRegionName)));
        services.AddAWSService<IAmazonDynamoDB>();
        services.AddAWSService<IAmazonSimpleSystemsManagement>();
        // S3 must use the *bucket's* region. Wrong region → GetObject ErrorCode NoSuchBucket even when the bucket exists.
        services.AddSingleton<IAmazonS3>(_ =>
        {
            static string? FirstNonEmpty(params string?[] candidates)
            {
                foreach (var c in candidates)
                {
                    var t = c?.Trim();
                    if (!string.IsNullOrEmpty(t)) return t;
                }

                return null;
            }

            var regionName = FirstNonEmpty(
                Configuration["MEDIA_BUCKET_REGION"],
                Configuration["MEDIA_BUCKET_S3_REGION"],
                Environment.GetEnvironmentVariable("MEDIA_BUCKET_REGION"),
                Environment.GetEnvironmentVariable("AWS_REGION"),
                Configuration["AWS:Region"],
                Configuration["Aws:Region"]) ?? "us-east-1";
            var re = RegionEndpoint.GetBySystemName(regionName);
            // us-east-1 defaults to legacy global endpoint (s3.amazonaws.com); that can yield NoSuchBucket on GetObject
            // for normal buckets — force regional endpoint (s3.us-east-1.amazonaws.com).
            var s3Config = new AmazonS3Config { RegionEndpoint = re };
            if (string.Equals(regionName, "us-east-1", StringComparison.OrdinalIgnoreCase))
            {
                s3Config.USEast1RegionalEndpointValue = S3UsEast1RegionalEndpointValue.Regional;
            }

            Log.Information(
                "S3 client (media GetObject/presign) region={Region} usEast1Endpoint={UsEast1Mode} (set MEDIA_BUCKET_REGION if bucket is not in this region)",
                regionName,
                string.Equals(regionName, "us-east-1", StringComparison.OrdinalIgnoreCase)
                    ? "regional"
                    : "n/a");
            return new AmazonS3Client(s3Config);
        });
        services.AddAWSService<Amazon.SimpleEmail.IAmazonSimpleEmailService>();
        services.AddScoped<IDynamoDBContext>(sp => new DynamoDBContext(sp.GetRequiredService<IAmazonDynamoDB>()));

        // Add application services
        services.AddScoped<IProfileService, ProfileService>();
        services.AddScoped<IMatchService, MatchService>();
        services.AddScoped<IChatService, ChatService>();
        services.AddScoped<IUserActivityService, UserActivityService>();
        services.AddScoped<IActivityAnalyticsService, ActivityAnalyticsService>();
        services.AddScoped<IChatNotificationService, ChatNotificationService>();
        services.AddScoped<GetTrainMate.Api.Services.IEventService, GetTrainMate.Api.Services.EventService>();
        services.AddScoped<IPaymentService, PaymentService>();
        services.AddScoped<ISecretsService, SecretsService>();
        services.AddScoped<IAdminService, AdminService>();
        services.AddScoped<IAdminAuthorizationService, AdminAuthorizationService>();
        services.AddScoped<IAuditLogService, AuditLogService>();
        services.AddScoped<IEmailService, EmailService>();
        services.AddScoped<IAdminNotificationService, AdminNotificationService>();
        services.AddScoped<ICognitoAdminUserDeletionService, CognitoAdminUserDeletionService>();
        services.AddScoped<ICognitoRegistrationCheckService, CognitoRegistrationCheckService>();
        services.AddScoped<ILandingMatchPreviewService, LandingMatchPreviewService>();
        services.AddScoped<IBillingService, BillingService>();
        services.AddScoped<ICreditsService, CreditsService>();
        services.AddScoped<ISportsEventLayerService, SportsEventLayerService>();
        services.AddHttpClient("WorldCupScores", client =>
        {
            client.Timeout = TimeSpan.FromSeconds(10);
            client.DefaultRequestHeaders.UserAgent.ParseAdd("GetTrainMate/1.0 (World Cup fan hub)");
        });
        services.AddScoped<IEventHubService, EventHubService>();

        // Bedrock & AI: config-driven (stub when Bedrock:ModelId not set)
        // Priority: SSM /gettrainmate/bedrock/model-id > env BEDROCK_MODEL_ID > appsettings
        services.Configure<BedrockOptions>(Configuration.GetSection(BedrockOptions.SectionName));
        services.PostConfigure<BedrockOptions>(options =>
        {
            var envModelId = Environment.GetEnvironmentVariable("BEDROCK_MODEL_ID");
            var fromEnv = !string.IsNullOrWhiteSpace(envModelId) ? envModelId : null;
            var fromSsm = (string?)null;
            try
            {
                using var ssm = new AmazonSimpleSystemsManagementClient();
                var resp = ssm.GetParameterAsync(new GetParameterRequest { Name = "/gettrainmate/bedrock/model-id" }).GetAwaiter().GetResult();
                fromSsm = resp.Parameter?.Value?.Trim();
                if (!string.IsNullOrWhiteSpace(fromSsm))
                    Log.Information("Bedrock model ID loaded from SSM: {ModelId}", fromSsm);
            }
            catch (ParameterNotFoundException) { /* SSM param optional */ }
            catch (Exception ex) { Log.Warning(ex, "Could not load Bedrock model ID from SSM"); }

            var resolved = fromSsm ?? fromEnv ?? options.ModelId;
            if (!string.IsNullOrWhiteSpace(resolved))
                options.ModelId = resolved;
        });
        services.Configure<AiCreditCostsOptions>(Configuration.GetSection(AiCreditCostsOptions.SectionName));
        services.AddSingleton<IBedrockClientWrapper, BedrockClientWrapper>();
        services.AddScoped<IBedrockChatService, BedrockChatService>();
        services.AddScoped<IBedrockGuardrails, BedrockGuardrailsStub>();
        services.AddScoped<IBedrockKnowledgeBase, BedrockKnowledgeBaseStub>();
        services.AddScoped<IAiMatchInsightService, AiMatchInsightService>();
        services.AddScoped<IAiIcebreakerService, AiIcebreakerService>();
        services.AddScoped<IAiProfileOptimizerService, AiProfileOptimizerService>();
        services.AddScoped<IAiWorkoutPlannerService, AiWorkoutPlannerService>();
        services.AddScoped<IAiHelpAssistantService, AiHelpAssistantService>();

        services.AddHttpContextAccessor();
        services.AddSingleton<IStorageService, S3StorageService>();
        services.AddHostedService<MediaBucketBootstrapHostedService>();

        // Configure Stripe: API key from config → env → SSM. Webhook signing secret merges SSM + env so a stale
        // Lambda STRIPE_WEBHOOK_SECRET cannot shadow an updated SSM value (common cause of "Invalid signature" while SSM is "correct").
        var stripeKey = Configuration["Stripe:SecretKey"]
            ?? Environment.GetEnvironmentVariable("STRIPE_SECRET_KEY");
        var stripeWebhookFromConfig = Configuration["Stripe:WebhookSecret"]
            ?? Environment.GetEnvironmentVariable("STRIPE_WEBHOOK_SECRET");

        var ssmSecretKey = "/gettrainmate/stripe/secret-key";
        var ssmWebhookSecret = "/gettrainmate/stripe/webhook-secret";

        static void AppendWebhookSecretSegments(List<string> dest, string? raw)
        {
            if (string.IsNullOrWhiteSpace(raw)) return;
            foreach (var seg in raw.Split(new[] { ',', ';', '\n', '\r' }, StringSplitOptions.RemoveEmptyEntries))
            {
                var t = seg.Trim();
                if (t.Length == 0) continue;
                if (!dest.Contains(t, StringComparer.Ordinal)) dest.Add(t);
            }
        }

        string? stripeWebhookFromSsm = null;
        try
        {
            using var ssm = new AmazonSimpleSystemsManagementClient();
            if (string.IsNullOrEmpty(stripeKey))
            {
                var keyResponse = ssm.GetParameterAsync(new GetParameterRequest
                {
                    Name = ssmSecretKey,
                    WithDecryption = true
                }).GetAwaiter().GetResult();
                stripeKey = keyResponse.Parameter.Value?.Trim() ?? "";
                Log.Information("Stripe secret key loaded from SSM {Param}", ssmSecretKey);
            }

            try
            {
                var whResponse = ssm.GetParameterAsync(new GetParameterRequest
                {
                    Name = ssmWebhookSecret,
                    WithDecryption = true
                }).GetAwaiter().GetResult();
                stripeWebhookFromSsm = whResponse.Parameter?.Value?.Trim();
                if (!string.IsNullOrEmpty(stripeWebhookFromSsm))
                    Log.Information("Stripe webhook signing secret loaded from SSM {Param}", ssmWebhookSecret);
            }
            catch (ParameterNotFoundException)
            {
                // optional
            }
        }
        catch (ParameterNotFoundException)
        {
            Log.Warning("Stripe SSM parameters not found. Create with: aws ssm put-parameter --name {Key} --value sk_live_XXX --type SecureString", ssmSecretKey);
        }
        catch (Exception ex)
        {
            Log.Warning(ex, "Could not load Stripe keys from SSM. Ensure Lambda has ssm:GetParameter on /gettrainmate/*");
        }

        var whMergeList = new List<string>();
        AppendWebhookSecretSegments(whMergeList, stripeWebhookFromSsm);
        AppendWebhookSecretSegments(whMergeList, stripeWebhookFromConfig);
        var stripeWebhookSecret = string.Join(",", whMergeList);

        if (!string.IsNullOrEmpty(stripeWebhookFromSsm)
            && !string.IsNullOrEmpty(stripeWebhookFromConfig)
            && !string.Equals(stripeWebhookFromSsm.Trim(), stripeWebhookFromConfig.Trim(), StringComparison.Ordinal))
        {
            Log.Warning(
                "Stripe webhook signing secret: SSM and Lambda env/config (STRIPE_WEBHOOK_SECRET / Stripe:WebhookSecret) differ. " +
                "Verification tries SSM value(s) first, then env. Remove the stale env var on the Lambda if only SSM should apply — see docs/STRIPE_SSM_SETUP.md.");
        }
        if (!string.IsNullOrEmpty(stripeKey))
        {
            StripeConfiguration.ApiKey = stripeKey;
        }

        var wh = stripeWebhookSecret ?? string.Empty;
        if (!string.IsNullOrEmpty(wh))
        {
            var trimmed = wh.Trim();
            var firstSeg = trimmed.Split(new[] { ',', ';', '\n', '\r' }, StringSplitOptions.RemoveEmptyEntries).FirstOrDefault()?.Trim() ?? "";
            var looksLikeSigningSecret = firstSeg.StartsWith("whsec_", StringComparison.Ordinal);
            Log.Information(
                "Stripe webhook signing secret: length={Len}, firstSegmentPrefixOk={Ok} (must be whsec_ from Webhooks → endpoint → Signing secret)",
                trimmed.Length,
                looksLikeSigningSecret);
            if (!looksLikeSigningSecret)
                Log.Warning(
                    "Stripe webhook secret does not look like a webhook signing secret (expected whsec_...). " +
                    "Using the API secret key or wrong parameter will always produce Invalid signature.");
        }
        else
            Log.Warning("Stripe webhook signing secret is empty; webhook verification is disabled until SSM /gettrainmate/stripe/webhook-secret or Stripe:WebhookSecret is set.");

        services.AddSingleton(new StripeWebhookSecret(wh));

        // SES: appsettings / Lambda env → SSM /gettrainmate/ses-from-email (matches Stripe/Bedrock pattern)
        static string? EnvNonEmpty(string name)
        {
            var v = Environment.GetEnvironmentVariable(name);
            return string.IsNullOrWhiteSpace(v) ? null : v.Trim();
        }

        static string FirstNonEmpty(params string?[] candidates)
        {
            foreach (var c in candidates)
                if (!string.IsNullOrWhiteSpace(c))
                    return c!.Trim();
            return "";
        }

        var sesFromEmail = FirstNonEmpty(Configuration["SES:FromEmail"], EnvNonEmpty("SES_FROM_EMAIL"));
        var sesAdminEmail = FirstNonEmpty(Configuration["SES:AdminEmail"], EnvNonEmpty("SES_ADMIN_EMAIL"));
        const string ssmSesFrom = "/gettrainmate/ses-from-email";
        const string ssmSesAdmin = "/gettrainmate/ses-admin-email";
        if (string.IsNullOrEmpty(sesFromEmail) || string.IsNullOrEmpty(sesAdminEmail))
        {
            try
            {
                using var ssmSes = new AmazonSimpleSystemsManagementClient();
                if (string.IsNullOrEmpty(sesFromEmail))
                {
                    var fromResp = ssmSes.GetParameterAsync(new GetParameterRequest { Name = ssmSesFrom })
                        .GetAwaiter().GetResult();
                    sesFromEmail = fromResp.Parameter?.Value?.Trim() ?? "";
                    if (!string.IsNullOrEmpty(sesFromEmail))
                    {
                        Environment.SetEnvironmentVariable("SES_FROM_EMAIL", sesFromEmail);
                        Log.Information("SES from-address loaded from SSM {Param}", ssmSesFrom);
                    }
                }
                if (string.IsNullOrEmpty(sesAdminEmail))
                {
                    try
                    {
                        var adminResp = ssmSes.GetParameterAsync(new GetParameterRequest { Name = ssmSesAdmin })
                            .GetAwaiter().GetResult();
                        sesAdminEmail = adminResp.Parameter?.Value?.Trim() ?? "";
                        if (!string.IsNullOrEmpty(sesAdminEmail))
                            Environment.SetEnvironmentVariable("SES_ADMIN_EMAIL", sesAdminEmail);
                    }
                    catch (ParameterNotFoundException) { /* optional */ }
                }
            }
            catch (ParameterNotFoundException)
            {
                Log.Warning("SES SSM parameter not found at {Param}. Set SES_FROM_EMAIL on the Lambda or create the parameter.", ssmSesFrom);
            }
            catch (Exception ex)
            {
                Log.Warning(ex, "Could not load SES settings from SSM");
            }
        }

        services.AddAuthorization(options =>
        {
            options.FallbackPolicy = null;
        });
        services.AddControllers();
        services.AddCors(options =>
        {
            options.AddPolicy("AllowAll", builder =>
            {
                builder
                    .AllowAnyOrigin()
                    .AllowAnyMethod()
                    .AllowAnyHeader()
                    .WithExposedHeaders("Content-Type", "Authorization", "X-Admin-Token");
            });
        });
        services.AddHealthChecks();
    }

    public void Configure(IApplicationBuilder app, IWebHostEnvironment env)
    {
        try
        {
            using var scope = app.ApplicationServices.CreateScope();
            var sportsLayer = scope.ServiceProvider.GetRequiredService<ISportsEventLayerService>();
            sportsLayer.EnsureDefaultSeedDataAsync().GetAwaiter().GetResult();
            var eventHub = scope.ServiceProvider.GetRequiredService<IEventHubService>();
            eventHub.EnsureWorldCupSeedAsync().GetAwaiter().GetResult();
        }
        catch (Exception ex)
        {
            // Never block API startup if optional Sports Event Layer tables are missing.
            Console.WriteLine($"[Startup] Sports Event Layer seed skipped: {ex.Message}");
        }

        var inLambda = !string.IsNullOrEmpty(Environment.GetEnvironmentVariable("AWS_LAMBDA_FUNCTION_NAME"));
        // API Gateway terminates TLS. HTTPS redirection inside Lambda can turn OPTIONS preflight into a
        // redirect (non-2xx) and the browser reports a CORS failure.
        if (!inLambda)
            app.UseHttpsRedirection();

        app.UseRouting();
        // Single CORS owner for all environments (CDK HttpApi corsPreflight removed — it conflicted with Lambda proxy).
        app.UseCors("AllowAll");

        // Must run before any middleware that could touch the body; Stripe verifies HMAC over raw bytes.
        app.UseMiddleware<StripeWebhookBufferingMiddleware>();

        app.UseMiddleware<CognitoAuthMiddleware>();
        app.UseMiddleware<AdminTokenAuthMiddleware>();
        app.UseAuthorization();
        app.UseMiddleware<AdminAuthorizationMiddleware>();

        app.UseEndpoints(endpoints =>
        {
            endpoints.MapHealthChecks("/api/health");
            endpoints.MapControllers();
        });
    }
}
