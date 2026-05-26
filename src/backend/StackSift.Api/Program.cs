using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using System.Reflection;
using Keycloak.AuthServices.Authentication;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.OpenApi.Models;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;
using Serilog;
using Serilog.Events;
using Serilog.Formatting.Compact;
using Serilog.Sinks.Grafana.Loki;
using StackSift.Api.Middleware;
using StackSift.Application;
using StackSift.Infrastructure.Extensions;
using StackSift.Infrastructure.Persistence;
using Hangfire;
using StackSift.Infrastructure.Jobs;
using StackSift.Infrastructure.SignalR;

var builder = WebApplication.CreateBuilder(args);

// Conventional OpenAI env var — promote to the OpenAI:ApiKey config slot. 
var openAiKey = Environment.GetEnvironmentVariable("OPENAI_API_KEY");
if (!string.IsNullOrWhiteSpace(openAiKey))
    builder.Configuration["OpenAI:ApiKey"] = openAiKey;

builder.Host.UseSerilog((ctx, sp, cfg) =>
{
    cfg.ReadFrom.Configuration(ctx.Configuration)
        .Enrich.FromLogContext()
        .Enrich.WithProperty("Application", "StackSift.Api")
        .MinimumLevel.Override("Microsoft.AspNetCore", LogEventLevel.Warning);

    if (ctx.HostingEnvironment.IsDevelopment())
        cfg.WriteTo.Console(
            outputTemplate: "[{Timestamp:HH:mm:ss} {Level:u3}] {CorrelationId,-36} {Message:lj}{NewLine}{Exception}");
    else
        cfg.WriteTo.Console(new CompactJsonFormatter());

    var lokiUrl = ctx.Configuration["Serilog:Loki:Url"];
    if (!string.IsNullOrWhiteSpace(lokiUrl))
    {
        cfg.WriteTo.GrafanaLoki(
            uri: lokiUrl,
            labels: new[]
            {
                new LokiLabel { Key = "app", Value = "stacksift" },
                new LokiLabel { Key = "env", Value = ctx.HostingEnvironment.EnvironmentName }
            },
            // Only bounded-cardinality properties become Loki labels.
            // CorrelationId stays in the JSON line — do NOT add it here or Loki
            // will create one stream per request (cardinality explosion).
            propertiesAsLabels: new[] { "level" });
    }
});

builder.Services.AddOpenTelemetry()
    .ConfigureResource(r => r.AddService("StackSift.Api"))
    .WithTracing(t =>
    {
        t.AddAspNetCoreInstrumentation()
            .AddHttpClientInstrumentation();
        if (builder.Environment.IsDevelopment())
            t.AddConsoleExporter();
        else
            t.AddOtlpExporter();
    });

builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo
    {
        Version = "v1",
        Title = "StackSift API",
    });
    var xmlPath = Path.Combine(AppContext.BaseDirectory, $"{Assembly.GetExecutingAssembly().GetName().Name}.xml");
    options.IncludeXmlComments(xmlPath);
    options.MapType<IFormFile>(() => new OpenApiSchema { Type = "string", Format = "binary" });
    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Paste a Keycloak JWT token here",
    });
    options.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer",
                },
            },
            Array.Empty<string>()
        }
    });
});

builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter(JsonNamingPolicy.CamelCase));
        options.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
    });

builder.Services.AddKeycloakWebApiAuthentication(
    builder.Configuration,
    o =>
    {
        o.RequireHttpsMetadata = false;
        o.Events = new JwtBearerEvents
        {
            // WebSocket/SSE upgrades can't carry an Authorization header —
            // SignalR passes the token as ?access_token= instead.
            OnMessageReceived = ctx =>
            {
                var token = ctx.Request.Query["access_token"].ToString();
                if (!string.IsNullOrEmpty(token) &&
                    ctx.HttpContext.Request.Path.StartsWithSegments("/hubs"))
                    ctx.Token = token;
                return Task.CompletedTask;
            },
            OnChallenge = ctx =>
            {
                ctx.HandleResponse();
                return JwtProblemDetailsHelper.WriteAsync(ctx.HttpContext, 401, "Unauthorized");
            },
            OnForbidden = ctx =>
                JwtProblemDetailsHelper.WriteAsync(ctx.HttpContext, 403, "Forbidden"),
        };
    });

builder.Services.AddAuthorization(options =>
{
    var viewerOrAbove = new AuthorizationPolicyBuilder()
        .RequireAuthenticatedUser()
        .RequireClaim("stacksift_role", "owner", "admin", "member", "viewer")
        .Build();

    options.DefaultPolicy = viewerOrAbove;
    options.AddPolicy("ViewerOrAbove", viewerOrAbove);
    options.AddPolicy("MemberOrAbove", p =>
        p.RequireAuthenticatedUser().RequireClaim("stacksift_role", "owner", "admin", "member"));
    options.AddPolicy("AdminOrAbove", p =>
        p.RequireAuthenticatedUser().RequireClaim("stacksift_role", "owner", "admin"));
    options.AddPolicy("OwnerOnly", p =>
        p.RequireAuthenticatedUser().RequireClaim("stacksift_role", "owner"));
});

builder.Services.AddRateLimiter(options =>
{
    // POST /api/v1/logs/ingest — partitioned per API key (falls back to remote IP)
    options.AddPolicy<string>("LogIngest", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Request.Headers.TryGetValue("X-Api-Key", out var apiKey)
                          && !string.IsNullOrWhiteSpace(apiKey)
                ? apiKey.ToString()
                : httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                Window = TimeSpan.FromSeconds(60),
                PermitLimit = 100,
                QueueLimit = 0,
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
            }));

    // POST /api/v1/files/upload — partitioned per organisation (falls back to remote IP)
    options.AddPolicy<string>("FileUpload", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.User.FindFirst("organization_id")?.Value
                          ?? httpContext.Connection.RemoteIpAddress?.ToString()
                          ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                Window = TimeSpan.FromSeconds(60),
                PermitLimit = 20,
                QueueLimit = 0,
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
            }));

    // GET /api/v1/health — partitioned per remote IP
    options.AddPolicy<string>("HealthCheck", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                Window = TimeSpan.FromSeconds(60),
                PermitLimit = 30,
                QueueLimit = 0,
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
            }));

    // POST /api/v1/auth/register — partitioned per remote IP
    options.AddPolicy<string>("Register", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                Window = TimeSpan.FromMinutes(10),
                PermitLimit = 5,
                QueueLimit = 0,
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
            }));

    options.OnRejected = async (context, ct) =>
    {
        var httpContext = context.HttpContext;
        var traceId = httpContext.Items[CorrelationIdMiddleware.ItemKey] as string;

        var retryAfter = 60;
        if (context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var hint))
            retryAfter = (int)Math.Ceiling(hint.TotalSeconds);

        var body = new ApiErrorResponse(
            Type: "https://httpstatuses.io/429",
            Title: "Too Many Requests",
            Status: StatusCodes.Status429TooManyRequests,
            Detail: $"Rate limit exceeded. Retry after {retryAfter} seconds.",
            TraceId: traceId,
            Errors: null);

        httpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
        httpContext.Response.ContentType = "application/problem+json";
        httpContext.Response.Headers.RetryAfter = retryAfter.ToString();

        await httpContext.Response.WriteAsync(
            JsonSerializer.Serialize(body, JwtProblemDetailsHelper.JsonOpts), ct);
    };
});

builder.Services.AddSignalR()
    .AddStackExchangeRedis(
        builder.Configuration["Redis:ConnectionString"] ?? "localhost:6379");

builder.Services.AddCors(options =>
    options.AddPolicy("Frontend", p => p
        .WithOrigins("http://localhost:3000")
        .AllowAnyHeader()
        .AllowAnyMethod()
        .AllowCredentials()));

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await db.Database.MigrateAsync();
}

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "StackSift API v1");
    });
}

app.UseMiddleware<ExceptionHandlingMiddleware>();
app.UseMiddleware<CorrelationIdMiddleware>();
app.UseSerilogRequestLogging(opts =>
{
    opts.GetLevel = (http, _, _) =>
        http.Request.Path.StartsWithSegments("/api/v1/health")
            ? LogEventLevel.Verbose
            : LogEventLevel.Information;
    opts.EnrichDiagnosticContext = (diag, http) =>
    {
        if (http.Items.TryGetValue(CorrelationIdMiddleware.ItemKey, out var cid))
            diag.Set("CorrelationId", cid);
    };
});
app.UseHttpsRedirection();
app.UseCors("Frontend");
app.UseRouting();
app.UseRateLimiter();
app.UseAuthentication();
app.UseMiddleware<ApiKeyAuthMiddleware>();
app.UseAuthorization();

if (app.Environment.IsDevelopment())
{
    app.UseHangfireDashboard("/hangfire");
}
else
{
    app.MapHangfireDashboard("/hangfire").RequireAuthorization("AdminOrAbove");
}

using (var scope = app.Services.CreateScope())
{
    var rj = scope.ServiceProvider.GetRequiredService<IRecurringJobManager>();
    rj.AddOrUpdate<DigestEmailJob>(
        "digest-email-daily",
        j => j.ExecuteAsync(CancellationToken.None),
        "0 8 * * *",
        new RecurringJobOptions { TimeZone = TimeZoneInfo.Utc });
    rj.AddOrUpdate<LogRetentionJob>(
        "log-retention-daily",
        j => j.ExecuteAsync(CancellationToken.None),
        "0 2 * * *",
        new RecurringJobOptions { TimeZone = TimeZoneInfo.Utc });
    rj.AddOrUpdate<StripeReconciliationJob>(
        "stripe-reconciliation-weekly",
        j => j.ExecuteAsync(CancellationToken.None),
        "0 3 * * 0",
        new RecurringJobOptions { TimeZone = TimeZoneInfo.Utc });
}

app.MapControllers();
app.MapHub<AlertHub>("/hubs/stacksift");
app.MapFallback(async ctx =>
{
    var traceId = ctx.Items[CorrelationIdMiddleware.ItemKey] as string;
    var body = new ApiErrorResponse(
        Type: "https://httpstatuses.io/404",
        Title: "Not Found",
        Status: 404,
        Detail: $"No endpoint matched '{ctx.Request.Path}'.",
        TraceId: traceId,
        Errors: null);
    ctx.Response.StatusCode = 404;
    ctx.Response.ContentType = "application/problem+json";
    await ctx.Response.WriteAsync(
        JsonSerializer.Serialize(body, JwtProblemDetailsHelper.JsonOpts));
});

try
{
    app.Run();
}
catch (Exception ex)
{
    Log.Fatal(ex, "Host terminated unexpectedly");
    throw;
}
finally
{
    Log.CloseAndFlush();
}

// Expose Program to the test assembly so WebApplicationFactory<Program> can reference it.
public partial class Program { }