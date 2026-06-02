using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using System.Reflection;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Keycloak.AuthServices.Authentication;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.OpenApi.Models;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;
using Prometheus;
using Serilog;
using Serilog.Events;
using Serilog.Formatting.Compact;
using Serilog.Sinks.Grafana.Loki;
using StackSift.Api.Health;
using StackSift.Api.Middleware;
using StackSift.Api.Observability;
using StackSift.Application;
using StackSift.Application.Interfaces;
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
        t.SetSampler(builder.Environment.IsDevelopment()
                ? new AlwaysOnSampler()
                : new TraceIdRatioBasedSampler(0.1))
            .AddSource("MassTransit")
            .AddSource("Hangfire")
            // Plan 09 §9.13: emit Npgsql's connection-pool counters and
            // command-execution histograms so the Postgres-DBA dashboard
            // can correlate API-side pool saturation with server-side
            // pg_stat_statements rows.
            .AddSource("Npgsql")
            .AddAspNetCoreInstrumentation(options =>
            {
                options.Filter = context =>
                    !context.Request.Path.StartsWithSegments("/health")
                    && !context.Request.Path.StartsWithSegments("/metrics");
            })
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
builder.Services.AddSingleton<IStackSiftMetrics, StackSiftMetrics>();
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter(JsonNamingPolicy.CamelCase));
        options.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
    });

builder.Services.AddHealthChecks()
    .AddCheck("self", () => HealthCheckResult.Healthy(), tags: ["live"])
    .AddCheck<PostgresReadyHealthCheck>(
        "postgres",
        failureStatus: HealthStatus.Unhealthy,
        tags: ["ready"],
        timeout: TimeSpan.FromMilliseconds(800))
    .AddCheck<RedisReadyHealthCheck>(
        "redis",
        failureStatus: HealthStatus.Unhealthy,
        tags: ["ready"],
        timeout: TimeSpan.FromMilliseconds(500))
    .AddCheck<RabbitMqReadyHealthCheck>(
        "rabbitmq",
        failureStatus: HealthStatus.Unhealthy,
        tags: ["ready"],
        timeout: TimeSpan.FromMilliseconds(500))
    .AddCheck<ElasticsearchReadyHealthCheck>(
        "elasticsearch",
        failureStatus: HealthStatus.Unhealthy,
        tags: ["ready"],
        timeout: TimeSpan.FromMilliseconds(800))
    .AddCheck<MigrationsAppliedHealthCheck>(
        "migrations",
        failureStatus: HealthStatus.Unhealthy,
        tags: ["startup", "ready"],
        timeout: TimeSpan.FromMilliseconds(800));

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

// Keycloak sits behind two hostnames in Docker: the public URL
// (KC_HOSTNAME → token issuer, e.g. http://localhost:8080) and the internal
// URL (AuthServerUrl, http://keycloak:8080) used to fetch metadata/JWKS via
// backchannel-dynamic. Accept the public issuer while metadata stays internal.
{
    var realm = builder.Configuration["Keycloak:Realm"] ?? "stacksift";
    var internalAuth = (builder.Configuration["Keycloak:AuthServerUrl"] ?? "http://keycloak:8080").TrimEnd('/');
    var publicAuth = (builder.Configuration["Keycloak:PublicAuthServerUrl"] ?? internalAuth).TrimEnd('/');
    builder.Services.PostConfigure<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme, o =>
    {
        o.TokenValidationParameters ??= new();
        o.TokenValidationParameters.ValidateIssuer = true;
        o.TokenValidationParameters.ValidIssuers =
        [
            $"{publicAuth}/realms/{realm}",
            $"{internalAuth}/realms/{realm}",
        ];
    });
}

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
    // Defense-in-depth on top of Keycloak's verify-before-login: data endpoints
    // require a verified email. The API-key ingest principal carries email_verified
    // = "true" (it's a machine identity) so ingestion is unaffected.
    options.AddPolicy("EmailVerified", p =>
        p.RequireAuthenticatedUser().RequireClaim("email_verified", "true"));
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

    // Authenticated default — token bucket per user (sub), falling back to IP.
    var perUserPermit = builder.Configuration.GetValue("RateLimiting:PerUserPermitPerMinute", 200);
    options.AddPolicy<string>("PerUser", httpContext =>
        RateLimitPartition.GetTokenBucketLimiter(
            partitionKey: httpContext.User.FindFirst("sub")?.Value
                          ?? httpContext.Connection.RemoteIpAddress?.ToString()
                          ?? "anon",
            factory: _ => new TokenBucketRateLimiterOptions
            {
                TokenLimit = perUserPermit,
                TokensPerPeriod = perUserPermit,
                ReplenishmentPeriod = TimeSpan.FromMinutes(1),
                QueueLimit = 0,
                AutoReplenishment = true,
            }));

    // Per-organisation aggregate bucket (sum across a tenant's users/keys).
    var perOrgPermit = builder.Configuration.GetValue("RateLimiting:PerOrgPermitPerMinute", 1000);
    options.AddPolicy<string>("PerOrg", httpContext =>
        RateLimitPartition.GetTokenBucketLimiter(
            partitionKey: httpContext.User.FindFirst("organization_id")?.Value
                          ?? httpContext.Connection.RemoteIpAddress?.ToString()
                          ?? "anon",
            factory: _ => new TokenBucketRateLimiterOptions
            {
                TokenLimit = perOrgPermit,
                TokensPerPeriod = perOrgPermit,
                ReplenishmentPeriod = TimeSpan.FromMinutes(1),
                QueueLimit = 0,
                AutoReplenishment = true,
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

var corsOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
    ?? ["http://localhost:3000"];
if (!builder.Environment.IsDevelopment() &&
    (corsOrigins.Length == 0 || corsOrigins.Any(o => o.Contains('*'))))
{
    throw new InvalidOperationException(
        "Cors:AllowedOrigins must be a non-empty list of exact origins (no wildcards) outside Development.");
}
builder.Services.AddCors(options =>
    options.AddPolicy("Frontend", p => p
        .WithOrigins(corsOrigins)
        .WithMethods("GET", "POST", "PUT", "PATCH", "DELETE")
        .WithHeaders("Authorization", "Content-Type", "X-Api-Key", "X-Correlation-ID")
        .AllowCredentials()
        .SetPreflightMaxAge(TimeSpan.FromMinutes(10))));

// Global request-body cap (11 MiB ≈ the 10 MiB ingest batch + headers). The file
// upload endpoint overrides this with [RequestSizeLimit(50 MB)].
builder.WebHost.ConfigureKestrel(o => o.Limits.MaxRequestBodySize = 11 * 1024 * 1024);

var app = builder.Build();

// Schema is applied by StackSift.MigrationRunner (a separate process running
// before any API pod starts). The API pod itself never calls MigrateAsync —
// that would race across replicas under a rolling deploy. Readiness probes
// (see MigrationsAppliedHealthCheck on the "ready" tag) fail open until the
// migration job catches up, keeping the pod alive but un-routable.

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
app.UseMiddleware<SecurityHeadersMiddleware>();
app.UseSerilogRequestLogging(opts =>
{
    opts.GetLevel = (http, _, _) =>
        http.Request.Path.StartsWithSegments("/api/v1/health")
        || http.Request.Path.StartsWithSegments("/health/live")
        || http.Request.Path.StartsWithSegments("/health/ready")
        || http.Request.Path.StartsWithSegments("/health/startup")
        || http.Request.Path.StartsWithSegments("/metrics")
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
app.UseHttpMetrics();
app.UseRateLimiter();
app.UseAuthentication();
app.UseMiddleware<ApiKeyAuthMiddleware>();
app.UseMiddleware<ObservabilityEnrichmentMiddleware>();
app.UseAuthorization();

if (app.Environment.IsDevelopment())
{
    app.UseHangfireDashboard("/hangfire");
}
else
{
    app.MapHangfireDashboard("/hangfire").RequireAuthorization("AdminOrAbove");
}

// Recurring jobs only register on the dedicated cronworker deployment.
// Plan 04 §4.7 + Plan 09 §9.6: registering on every API replica causes
// digest emails, retention sweeps, and reconciliation to compete on the
// shared Hangfire postgres schema. STACKSIFT_ROLE=cronworker selects the
// one pod that owns the cron. Local dev defaults to "api" (= run the
// cron on the lone API container so the dev workflow stays single-pod).
var stacksiftRole = Environment.GetEnvironmentVariable("STACKSIFT_ROLE") ?? "api";
if (stacksiftRole is "cronworker" or "api")
{
    using var scope = app.Services.CreateScope();
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
    rj.AddOrUpdate<RetentionEnforcementJob>(
        "retention-enforcement-daily",
        j => j.ExecuteAsync(CancellationToken.None),
        "30 2 * * *",
        new RecurringJobOptions { TimeZone = TimeZoneInfo.Utc });
    rj.AddOrUpdate<IAccountErasureJobRunner>(
        "account-erasure-daily",
        j => j.ExecuteAsync(CancellationToken.None),
        "45 2 * * *",
        new RecurringJobOptions { TimeZone = TimeZoneInfo.Utc });
    rj.AddOrUpdate<StripeReconciliationJob>(
        "stripe-reconciliation-weekly",
        j => j.ExecuteAsync(CancellationToken.None),
        "0 3 * * 0",
        new RecurringJobOptions { TimeZone = TimeZoneInfo.Utc });
    rj.AddOrUpdate<RefreshDisposableDomainsJob>(
        "refresh-disposable-domains-weekly",
        j => j.ExecuteAsync(CancellationToken.None),
        "0 4 * * 1",
        new RecurringJobOptions { TimeZone = TimeZoneInfo.Utc });
}

app.MapControllers();
app.MapHealthChecks("/health/live", new HealthCheckOptions
{
    Predicate = registration => registration.Tags.Contains("live"),
    ResponseWriter = HealthCheckJsonResponseWriter.WriteAsync,
});
app.MapHealthChecks("/health/ready", new HealthCheckOptions
{
    Predicate = registration => registration.Tags.Contains("ready"),
    ResponseWriter = HealthCheckJsonResponseWriter.WriteAsync,
});
app.MapHealthChecks("/health/startup", new HealthCheckOptions
{
    Predicate = registration => registration.Tags.Contains("startup"),
    ResponseWriter = HealthCheckJsonResponseWriter.WriteAsync,
});
app.MapMetrics();
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
