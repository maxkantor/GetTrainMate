using Amazon.DynamoDBv2;
using Amazon.DynamoDBv2.DataModel;
using Amazon.SimpleSystemsManagement;
using Amazon.S3;
using GetTrainMate.Api.Services;
using GetTrainMate.Api.Middleware;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Security.Claims;
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
        services.AddHttpContextAccessor();
        services.AddSingleton<IStorageService, S3StorageService>();

        // Configure Stripe (optional - only if key is provided)
        var stripeKey = Configuration["Stripe:SecretKey"]
            ?? Environment.GetEnvironmentVariable("STRIPE_SECRET_KEY");
        if (!string.IsNullOrEmpty(stripeKey))
        {
            StripeConfiguration.ApiKey = stripeKey;
        }

        // Configure Cognito JWT Authentication
        var userPoolId = Environment.GetEnvironmentVariable("COGNITO_USER_POOL_ID")
            ?? Configuration["Cognito:UserPoolId"]
            ?? "us-east-1_MRv5xL215"; // Default for now - should be set via env var

        var region = Environment.GetEnvironmentVariable("AWS_REGION") ?? "us-east-1";
        var issuer = $"https://cognito-idp.{region}.amazonaws.com/{userPoolId}";

        services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer(options =>
            {
                options.Authority = issuer;
                options.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuer = true,
                    ValidIssuer = issuer,
                    ValidateAudience = false,
                    ValidateLifetime = true,
                    ValidateIssuerSigningKey = true,
                    NameClaimType = ClaimTypes.NameIdentifier,
                    RoleClaimType = ClaimTypes.Role
                };

                options.Events = new JwtBearerEvents
                {
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
                    }
                };
            });

        services.AddAuthorization();
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
