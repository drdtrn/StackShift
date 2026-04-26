using Elastic.Clients.Elasticsearch;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using StackExchange.Redis;
using StackSift.Application.Interfaces;
using StackSift.Domain.Interfaces;
using StackSift.Domain.Interfaces.Repositories;
using StackSift.Infrastructure.Caching;
using StackSift.Infrastructure.Elasticsearch;
using StackSift.Infrastructure.Messaging;
using StackSift.Infrastructure.Persistence;
using StackSift.Infrastructure.Persistence.Repositories;
using StackSift.Infrastructure.Services;

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

        // ── Messaging (stub until BE-07 wires MassTransit) ───────────────
        services.AddScoped<IMessagePublisher, NoOpMessagePublisher>();

        return services;
    }
}
