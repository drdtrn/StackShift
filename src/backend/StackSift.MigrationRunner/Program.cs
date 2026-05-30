using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Pgvector.EntityFrameworkCore;
using StackSift.Domain.Interfaces;
using StackSift.Infrastructure.Persistence;
using StackSift.MigrationRunner;

var builder = Host.CreateApplicationBuilder(args);

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
if (string.IsNullOrWhiteSpace(connectionString))
{
    Console.Error.WriteLine(
        "ConnectionStrings__DefaultConnection is not set; cannot run migrations.");
    return 2;
}

builder.Services.AddSingleton<ICurrentUserService, MigrationCurrentUserService>();
builder.Services.AddSingleton<ICurrentOrgProvider, MigrationCurrentOrgProvider>();

builder.Services.AddDbContext<AppDbContext>(opts =>
    opts.UseNpgsql(
        connectionString,
        npgsql => npgsql
            .EnableRetryOnFailure(
                maxRetryCount: 5,
                maxRetryDelay: TimeSpan.FromSeconds(10),
                errorCodesToAdd: null)
            .CommandTimeout(300)
            .UseVector()));

var host = builder.Build();
var logger = host.Services.GetRequiredService<ILogger<Program>>();

await using var scope = host.Services.CreateAsyncScope();
var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

try
{
    var pending = (await db.Database.GetPendingMigrationsAsync()).ToList();
    if (pending.Count == 0)
    {
        logger.LogInformation("No pending migrations.");
        return 0;
    }

    logger.LogInformation(
        "Applying {Count} migration(s): {Migrations}",
        pending.Count,
        string.Join(", ", pending));

    await db.Database.MigrateAsync();

    logger.LogInformation("Migrations applied successfully.");
    return 0;
}
catch (Exception ex)
{
    logger.LogCritical(ex, "Migration failed.");
    return 1;
}
