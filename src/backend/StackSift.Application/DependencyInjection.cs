using FluentValidation;
using MediatR;
using Microsoft.Extensions.DependencyInjection;
using StackSift.Application.Behaviours;
using StackSift.Application.Interfaces;

namespace StackSift.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddMediatR(cfg =>
            cfg.RegisterServicesFromAssembly(typeof(DependencyInjection).Assembly));

        services.AddValidatorsFromAssembly(typeof(DependencyInjection).Assembly);

        services.AddTransient(typeof(IPipelineBehavior<,>), typeof(ValidationBehavior<,>));
        services.AddSingleton<IStackSiftMetrics, NoOpStackSiftMetrics>();

        return services;
    }
}
