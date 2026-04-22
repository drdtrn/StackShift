using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using StackSift.Domain.Interfaces;
using StackSift.Infrastructure.Persistence;
using StackSift.Infrastructure.Services;

namespace StackSift.Infrastructure.Extensions;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddDbContext<AppDbContext>(options => options.UseNpgsql(configuration.GetConnectionString("DefaultConnection"), b => b.UseVector()));

        services.AddScoped<ICurrentUserService, SystemCurrentUserService>();

        return services;
    }
}