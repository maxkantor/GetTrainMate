// This file is kept for local development/testing
// For Lambda, configuration is in Startup.cs
using Amazon.Lambda.Core;
using Amazon.Lambda.Serialization.SystemTextJson;

[assembly: LambdaSerializer(typeof(DefaultLambdaJsonSerializer))]

// Local development entry point
if (string.IsNullOrEmpty(Environment.GetEnvironmentVariable("AWS_LAMBDA_FUNCTION_NAME")))
{
    var builder = WebApplication.CreateBuilder(args);
    var app = builder.Build();
    await app.RunAsync();
}
