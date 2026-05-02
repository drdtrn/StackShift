using Elastic.Clients.Elasticsearch;
using Hangfire;
using Hangfire.PostgreSql;
using MailKit.Net.Smtp;
using MassTransit;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using StackExchange.Redis;
using StackSift.Application.Interfaces;
using StackSift.Application.Messages;
using StackSift.Domain.Interfaces;
using StackSift.Domain.Interfaces.Repositories;
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
using StackSift.Infrastructure.Jobs;

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

        return services;
    }
}
