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
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Microsoft.IdentityModel.Protocols;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using System.Linq;
using System.Security.Claims;
using System.IdentityModel.Tokens.Jwt;
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

        // Configure Cognito JWT Authentication
        // For now, disable automatic JWT validation - controllers will handle it manually
        // This avoids issues with User Pool configuration
        var userPoolId = Environment.GetEnvironmentVariable("COGNITO_USER_POOL_ID")
            ?? Configuration["Cognito:UserPoolId"];

        // Only configure JWT if User Pool ID is provided
        if (!string.IsNullOrEmpty(userPoolId))
        {
            var region = Environment.GetEnvironmentVariable("AWS_REGION") ?? "us-east-1";
            var issuer = $"https://cognito-idp.{region}.amazonaws.com/{userPoolId}";
            var jwksUri = $"{issuer}/.well-known/jwks.json";

            // Fetch and cache JWKS at startup. IssuerSigningKeyResolver needs keys synchronously;
            // when token has no kid, we return all keys so validator can try each one (fixes IDX10503).
            JsonWebKeySet? jwks = null;
            try
            {
                using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(10) };
                var json = http.GetStringAsync(jwksUri).GetAwaiter().GetResult();
                jwks = new JsonWebKeySet(json);
            }
            catch (Exception ex)
            {
                Log.Warning(ex, "Could not fetch Cognito JWKS from {Uri}, JWT validation may fail", jwksUri);
            }

            var keysList = jwks?.GetSigningKeys() ?? (IList<SecurityKey>)Array.Empty<SecurityKey>();
            var keys = keysList.ToArray();

            services.AddAuthentication(options =>
            {
                options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
                options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
            })
            .AddJwtBearer(options =>
            {
                // Use our own key resolver (handles tokens without kid). Do not use Authority/MetadataAddress
                // for key loading - that requires kid and causes IDX10503.
                options.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuer = false,
                    ValidateAudience = false,
                    ValidateLifetime = true,
                    ValidateIssuerSigningKey = true,
                    ValidIssuer = issuer,
                    NameClaimType = ClaimTypes.NameIdentifier,
                    RoleClaimType = ClaimTypes.Role,
                    IssuerSigningKeyResolver = (token, securityToken, kid, parameters) =>
                    {
                        if (keys.Length == 0) return keys;
                        if (string.IsNullOrEmpty(kid)) return keys;
                        var match = keys.OfType<Microsoft.IdentityModel.Tokens.JsonWebKey>()
                            .Where(k => string.Equals(k.Kid, kid, StringComparison.Ordinal)).ToArray();
                        return match.Length > 0 ? match : keys;
                    }
                };

                options.RequireHttpsMetadata = false;
                options.BackchannelTimeout = TimeSpan.FromSeconds(60);
                options.IncludeErrorDetails = true;
                
                // Handle authentication failures gracefully
                options.Events = new JwtBearerEvents
                {
                    OnAuthenticationFailed = context =>
                    {
                        // Log the error for debugging
                        var logger = context.HttpContext.RequestServices.GetRequiredService<ILogger<Startup>>();
                        logger.LogWarning(context.Exception, "JWT authentication failed: {Error}", context.Exception?.Message);
                        
                        // Don't fail the request - let it continue without authentication
                        // Controllers will check if authentication is needed
                        context.NoResult();
                        return Task.CompletedTask;
                    },
                    OnChallenge = context =>
                    {
                        // Don't automatically challenge - let controllers handle it
                        context.HandleResponse();
                        return Task.CompletedTask;
                    },
                    OnMessageReceived = context =>
                    {
                        var token = context.Request.Headers["Authorization"].FirstOrDefault()?.Replace("Bearer ", "");
                        if (string.IsNullOrEmpty(token))
                        {
                            token = context.Request.Query["access_token"].FirstOrDefault();
                        }

                        if (!string.IsNullOrEmpty(token))
                        {
                            context.Token = token;
                        }

                        return Task.CompletedTask;
                    },
                    OnTokenValidated = context =>
                    {
                        // Token is valid - log for debugging
                        var logger = context.HttpContext.RequestServices.GetRequiredService<ILogger<Startup>>();
                        var userId = context.Principal?.FindFirst(ClaimTypes.NameIdentifier)?.Value 
                            ?? context.Principal?.FindFirst("sub")?.Value;
                        logger.LogDebug("JWT token validated for user: {UserId}", userId);
                        return Task.CompletedTask;
                    }
                };
            });
        }
        else
        {
            // No User Pool configured - authentication will be handled manually in controllers
            services.AddAuthentication();
        }

        services.AddAuthorization(options =>
        {
            // Make authentication optional by default - controllers will require it explicitly
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
        // CORS must be first
        app.UseMiddleware<CorsMiddleware>();
        app.UseCors("AllowAll");
        app.UseHttpsRedirection();
        app.UseRouting();

        // Add authentication and authorization middleware
        // Authentication is optional - controllers will check if needed
        app.UseAuthentication();
        app.UseAuthorization();

        // Add admin authorization middleware
        app.UseMiddleware<AdminAuthorizationMiddleware>();

        app.UseEndpoints(endpoints =>
        {
            endpoints.MapHealthChecks("/api/health");
            endpoints.MapControllers();
        });
    }
}
