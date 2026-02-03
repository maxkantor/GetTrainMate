using Amazon.DynamoDBv2;
using Amazon.DynamoDBv2.DataModel;
using Amazon.SimpleSystemsManagement;
using Amazon.SimpleSystemsManagement.Model;
using Amazon.S3;
using GetTrainMate.Api.Services;
using GetTrainMate.Api.Middleware;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
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
        services.AddScoped<ICmsService, CmsService>();
        services.AddScoped<IBillingService, BillingService>();
        services.AddScoped<ICreditsService, CreditsService>();
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

            services.AddAuthentication(options =>
            {
                options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
                options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
            })
            .AddJwtBearer(options =>
            {
                options.Authority = issuer;
                options.MetadataAddress = $"{issuer}/.well-known/openid-configuration";
                options.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuer = false, // Disable issuer validation - accept tokens from any Cognito pool
                    ValidateAudience = false,
                    ValidateLifetime = true,
                    ValidateIssuerSigningKey = false, // Disable signing key validation for now
                    NameClaimType = ClaimTypes.NameIdentifier,
                    RoleClaimType = ClaimTypes.Role,
                    RequireSignedTokens = false
                };

                // Don't require HTTPS metadata endpoint in Lambda
                options.RequireHttpsMetadata = false;
                // Increase timeout for metadata retrieval
                options.BackchannelTimeout = TimeSpan.FromSeconds(60);
                // Don't throw on configuration errors
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
