using Amazon.CognitoIdentityProvider;
using Amazon.DynamoDBv2;
using Amazon.DynamoDBv2.DataModel;
using Amazon.SimpleSystemsManagement;
using Amazon.SimpleSystemsManagement.Model;
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

        // Add AWS services
        services.AddDefaultAWSOptions(Configuration.GetAWSOptions());
        services.AddAWSService<IAmazonCognitoIdentityProvider>();
        services.AddAWSService<IAmazonDynamoDB>();
        services.AddAWSService<IAmazonSimpleSystemsManagement>();
        services.AddAWSService<IAmazonS3>();
        services.AddAWSService<Amazon.SimpleEmail.IAmazonSimpleEmailService>();
        services.AddScoped<IDynamoDBContext>(sp => new DynamoDBContext(sp.GetRequiredService<IAmazonDynamoDB>()));

        // Add application services
        services.AddScoped<IProfileService, ProfileService>();
        services.AddScoped<IMatchService, MatchService>();
        services.AddScoped<IChatService, ChatService>();
        services.AddScoped<GetTrainMate.Api.Services.IEventService, GetTrainMate.Api.Services.EventService>();
        services.AddScoped<IPaymentService, PaymentService>();
        services.AddScoped<ISecretsService, SecretsService>();
        services.AddScoped<IAdminService, AdminService>();
        services.AddScoped<IAdminAuthorizationService, AdminAuthorizationService>();
        services.AddScoped<IAuditLogService, AuditLogService>();
        services.AddScoped<IEmailService, EmailService>();
        services.AddScoped<IBillingService, BillingService>();
        services.AddScoped<ICreditsService, CreditsService>();

        // Bedrock & AI: config-driven (stub when Bedrock:ModelId not set)
        services.Configure<BedrockOptions>(Configuration.GetSection(BedrockOptions.SectionName));
        services.PostConfigure<BedrockOptions>(options =>
        {
            if (string.IsNullOrWhiteSpace(options.ModelId))
            {
                var envModelId = Environment.GetEnvironmentVariable("BEDROCK_MODEL_ID");
                if (!string.IsNullOrWhiteSpace(envModelId))
                    options.ModelId = envModelId;
            }
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

        // Configure Stripe: config → env → SSM /gettrainmate/stripe/*
        var stripeKey = Configuration["Stripe:SecretKey"]
            ?? Environment.GetEnvironmentVariable("STRIPE_SECRET_KEY");
        var stripeWebhookSecret = Configuration["Stripe:WebhookSecret"]
            ?? Environment.GetEnvironmentVariable("STRIPE_WEBHOOK_SECRET");

        if (string.IsNullOrEmpty(stripeKey) || string.IsNullOrEmpty(stripeWebhookSecret))
        {
            try
            {
                using var ssm = new AmazonSimpleSystemsManagementClient();
                if (string.IsNullOrEmpty(stripeKey))
                {
                    var keyResponse = ssm.GetParameterAsync(new GetParameterRequest
                    {
                        Name = "/gettrainmate/stripe/secret-key",
                        WithDecryption = true
                    }).GetAwaiter().GetResult();
                    stripeKey = keyResponse.Parameter.Value?.Trim() ?? "";
                }
                if (string.IsNullOrEmpty(stripeWebhookSecret))
                {
                    var whResponse = ssm.GetParameterAsync(new GetParameterRequest
                    {
                        Name = "/gettrainmate/stripe/webhook-secret",
                        WithDecryption = true
                    }).GetAwaiter().GetResult();
                    stripeWebhookSecret = whResponse.Parameter.Value?.Trim() ?? "";
                }
            }
            catch (Exception ex)
            {
                Log.Warning(ex, "Could not load Stripe keys from SSM /gettrainmate/stripe/*");
            }
        }
        if (!string.IsNullOrEmpty(stripeKey))
        {
            StripeConfiguration.ApiKey = stripeKey;
        }
        services.AddSingleton(new StripeWebhookSecret(stripeWebhookSecret ?? string.Empty));

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
                    .WithExposedHeaders("Content-Type", "Authorization");
            });
        });
        services.AddHealthChecks();
    }

    public void Configure(IApplicationBuilder app, IWebHostEnvironment env)
    {
        app.UseMiddleware<CorsMiddleware>();
        app.UseCors("AllowAll");
        app.UseHttpsRedirection();
        app.UseRouting();

        app.UseMiddleware<CognitoAuthMiddleware>();
        app.UseAuthorization();
        app.UseMiddleware<AdminAuthorizationMiddleware>();

        app.UseEndpoints(endpoints =>
        {
            endpoints.MapHealthChecks("/api/health");
            endpoints.MapControllers();
        });
    }
}
