using Amazon;
using Amazon.S3;
using Elastic.Clients.Elasticsearch;
using Hangfire;
using Hangfire.PostgreSql;
using MailKit.Net.Smtp;
using MassTransit;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using OpenAI;
using StackExchange.Redis;
using StackSift.Application.Commands.Billing;
using StackSift.Application.Interfaces;
using StackSift.Application.Messages;
using StackSift.Domain.Interfaces;
using StackSift.Domain.Interfaces.Repositories;
using StackSift.Infrastructure.Ai;
using StackSift.Infrastructure.Ai.Abstractions;
using StackSift.Infrastructure.Billing;
using StackSift.Infrastructure.Caching;
using StackSift.Infrastructure.Elasticsearch;
using StackSift.Infrastructure.Email;
using StackSift.Infrastructure.Messaging;
using StackSift.Infrastructure.Messaging.Consumers;
using StackSift.Infrastructure.Persistence;
using StackSift.Infrastructure.Persistence.Repositories;
using StackSift.Infrastructure.Services;
using StackSift.Infrastructure.SignalR;
using StackSift.Infrastructure.Configuration;
using StackSift.Infrastructure.Identity;
using StackSift.Infrastructure.Jobs;
using StackSift.Infrastructure.Storage;

namespace StackSift.Infrastructure.Extensions;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services, IConfiguration configuration)
    {
        // ── EF Core / PostgreSQL ───────────────────────────────────────────
        services.AddDbContext<AppDbContext>(options =>
            options.UseNpgsql(
                configuration.GetConnectionString("DefaultConnection"),
                b => b.UseVector()));

        // ── Elasticsearch ─────────────────────────────────────────────────
        var esUri = configuration["Elasticsearch:Uri"] ?? "http://localhost:9200";
        var esSettings = new ElasticsearchClientSettings(new Uri(esUri));
        services.AddSingleton(new ElasticsearchClient(esSettings));

        // ── Current-user service ──────────────────────────────────────────
        services.AddHttpContextAccessor();
        services.AddScoped<ICurrentUserService, HttpContextCurrentUserService>();

        // ── Repositories ─────────────────────────────────────────────────
        services.AddScoped<IOrganizationRepository, OrganizationRepository>();
        services.AddScoped<IProjectRepository, ProjectRepository>();
        services.AddScoped<ILogSourceRepository, LogSourceRepository>();
        services.AddScoped<IAlertRuleRepository, AlertRuleRepository>();
        services.AddScoped<IAlertRepository, AlertRepository>();
        services.AddScoped<IIncidentRepository, IncidentRepository>();
        services.AddScoped<IAiAnalysisRepository, AiAnalysisRepository>();
        services.AddScoped<IUserRepository, UserRepository>();
        services.AddScoped<ILogEntryRepository, ElasticsearchLogEntryRepository>();

        // ── Unit of Work ─────────────────────────────────────────────────
        services.AddScoped<IUnitOfWork, UnitOfWork>();

        // ── Redis ─────────────────────────────────────────────────────────
        var redisConnectionString = configuration["Redis:ConnectionString"] ?? "localhost:6379";
        services.AddSingleton<IConnectionMultiplexer>(
            ConnectionMultiplexer.Connect(redisConnectionString));
        services.AddScoped<ICacheService, RedisCacheService>();

        services.AddScoped<IAlertHubService, AlertHubService>();

        // ── Keycloak admin client (service-account → admin REST API) ──────
        services.Configure<KeycloakAdminOptions>(configuration.GetSection("Keycloak:Admin"));
        services.AddHttpClient<IKeycloakAdminClient, KeycloakAdminClient>();

        // ── App options (frontend base URL for emails) ────────────────────
        services.Configure<AppOptions>(configuration.GetSection("App"));

        // ── Hangfire (PostgreSQL storage, separate schema) ────────────────
        services.AddHangfire(cfg => cfg
            .UseSimpleAssemblyNameTypeSerializer()
            .UseRecommendedSerializerSettings()
            .UsePostgreSqlStorage(c => c.UseNpgsqlConnection(
                configuration.GetConnectionString("DefaultConnection")),
                new PostgreSqlStorageOptions { SchemaName = "hangfire" }));
        services.AddHangfireServer(o => o.WorkerCount = 5);
        services.AddTransient<DigestEmailJob>();
        services.AddTransient<LogRetentionJob>();
        services.AddTransient<ImmediateAlertEmailJob>();
        services.AddTransient<StripeReconciliationJob>();

        // ── Email (MailKit + Polly) ────────────────────────────────────────
        var smtpSettings = configuration.GetSection("Smtp").Get<SmtpSettings>() ?? new SmtpSettings();
        services.AddSingleton(smtpSettings);
        services.AddTransient<ISmtpClient, SmtpClient>();
        services.AddScoped<IEmailService, MailKitEmailService>();

        // ── MassTransit / RabbitMQ ────────────────────────────────────────
        var rabbitHost = configuration["RabbitMq:Host"] ?? "localhost";
        var rabbitVHost = configuration["RabbitMq:VirtualHost"] ?? "/";
        var rabbitUser = configuration["RabbitMq:Username"] ?? "guest";
        var rabbitPass = configuration["RabbitMq:Password"] ?? "guest";

        services.AddMassTransit(bus =>
        {
            bus.AddConsumer<LogBatchConsumer>();
            bus.AddConsumer<AlertFiredConsumer>();

            bus.UsingRabbitMq((ctx, cfg) =>
            {
                cfg.Host(rabbitHost, rabbitVHost, h =>
                {
                    h.Username(rabbitUser);
                    h.Password(rabbitPass);
                });

                // Exchange topology for publishing
                cfg.Message<LogBatchMessage>(m => m.SetEntityName("log-ingest"));
                cfg.Publish<LogBatchMessage>(p => p.ExchangeType = "fanout");

                cfg.Message<AlertFiredMessage>(m => m.SetEntityName("alert-fired"));
                cfg.Publish<AlertFiredMessage>(p => p.ExchangeType = "fanout");

                // email-dead-letter exchange: published by MailKitEmailService after retry exhaustion
                // No consumer — messages accumulate for manual inspection and replay
                cfg.Message<EmailDeadLetterMessage>(m => m.SetEntityName("email-dead-letter"));
                cfg.Publish<EmailDeadLetterMessage>(p => p.ExchangeType = "fanout");
                cfg.ReceiveEndpoint("email-dead-letter-queue", e =>
                {
                    e.Bind("email-dead-letter", b => b.ExchangeType = "fanout");
                    e.ConfigureConsumeTopology = false;
                });

                // log-ingest-queue: consumers log batches, index to ES, evaluate alert rules
                cfg.ReceiveEndpoint("log-ingest-queue", e =>
                {
                    e.Bind("log-ingest", b => b.ExchangeType = "fanout");
                    e.ConfigureConsumeTopology = false;

                    // Dead-letter exchange for exhausted retries
                    e.SetQueueArgument("x-dead-letter-exchange", "log-ingest-dlx");

                    // 3 retries with exponential backoff: 5s → 15s → 30s
                    e.UseMessageRetry(r =>
                        r.Intervals(
                            TimeSpan.FromSeconds(5),
                            TimeSpan.FromSeconds(15),
                            TimeSpan.FromSeconds(30)));

                    e.Consumer<LogBatchConsumer>(ctx);
                });

                // alert-fired-queue: broadcasts alerts to SignalR hub
                cfg.ReceiveEndpoint("alert-fired-queue", e =>
                {
                    e.Bind("alert-fired", b => b.ExchangeType = "fanout");
                    e.ConfigureConsumeTopology = false;

                    e.UseMessageRetry(r =>
                        r.Intervals(
                            TimeSpan.FromSeconds(5),
                            TimeSpan.FromSeconds(15),
                            TimeSpan.FromSeconds(30)));

                    e.Consumer<AlertFiredConsumer>(ctx);
                });
            });
        });

        // IMessagePublisher now backed by MassTransit IPublishEndpoint
        services.AddScoped<IMessagePublisher, MassTransitMessagePublisher>();

        // ── OpenAI / AI services ──────────────────────────────────────────
        services.Configure<OpenAiOptions>(configuration.GetSection("OpenAI"));
        var openAiOpts = configuration.GetSection("OpenAI").Get<OpenAiOptions>() ?? new OpenAiOptions();

        services.AddSingleton(new OpenAIClient(
            string.IsNullOrWhiteSpace(openAiOpts.ApiKey) ? "sk-placeholder-not-configured" : openAiOpts.ApiKey));

        services.AddSingleton<IEmbedder>(sp =>
            new EmbeddingClientAdapter(
                sp.GetRequiredService<OpenAIClient>().GetEmbeddingClient(openAiOpts.EmbeddingModel)));
        services.AddSingleton<IChatCompleter>(sp =>
            new ChatClientAdapter(
                sp.GetRequiredService<OpenAIClient>().GetChatClient(openAiOpts.ChatModel)));

        services.AddScoped<IVectorSearchService, OpenAiVectorSearchService>();
        services.AddScoped<IAiAnalysisService, OpenAiAnalysisService>();
        services.AddTransient<RunAiAnalysisJob>();
        services.AddScoped<IAiAnalysisJobRunner, HangfireAiAnalysisJobRunner>();

        // ── S3 / MinIO file storage ────────────────────────────────────────
        services.Configure<S3StorageOptions>(configuration.GetSection("Storage:S3"));
        var s3Opts = configuration.GetSection("Storage:S3").Get<S3StorageOptions>() ?? new S3StorageOptions();
        var s3Config = new AmazonS3Config
        {
            ServiceURL = s3Opts.Endpoint,
            ForcePathStyle = true,
            AuthenticationRegion = s3Opts.Region,
        };
        services.AddSingleton<IAmazonS3>(new AmazonS3Client(s3Opts.AccessKey, s3Opts.SecretKey, s3Config));
        services.AddScoped<IFileStorageService, S3FileStorageService>();

        // ── Stripe billing ────────────────────────────────────────────────
        services.Configure<StripeOptions>(configuration.GetSection("Stripe"));
        services.AddSingleton<IStripeService, StripeService>();
        services.AddScoped<IStripeWebhookStore, StripeWebhookStore>();
        services.Configure<BillingPriceMap>(map =>
        {
            var stripeOpts = configuration.GetSection("Stripe").Get<StripeOptions>() ?? new StripeOptions();
            map.Indie = stripeOpts.Prices.Indie;
            map.Team = stripeOpts.Prices.Team;
        });

        return services;
    }
}
