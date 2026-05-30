using FluentAssertions;
using FluentValidation;
using MediatR;
using StackSift.Application.Commands.Logs;
using Xunit;

namespace StackSift.Tests.Application;

public sealed class EveryCommandHasValidatorTests
{
    [Fact]
    public void Every_command_has_a_fluentvalidation_validator()
    {
        var assembly = typeof(IngestLogBatchCommand).Assembly;

        var commands = assembly.GetTypes()
            .Where(t => t is { IsClass: true, IsAbstract: false }
                        && t.Namespace?.Contains(".Commands.") == true
                        && t.GetInterfaces().Any(i => i.IsGenericType
                            && i.GetGenericTypeDefinition() == typeof(IRequest<>)))
            .ToList();

        var validated = assembly.GetTypes()
            .Where(t => t.BaseType is { IsGenericType: true }
                        && t.BaseType.GetGenericTypeDefinition() == typeof(AbstractValidator<>))
            .Select(t => t.BaseType!.GetGenericArguments()[0])
            .ToHashSet();

        var missing = commands.Where(c => !validated.Contains(c)).Select(c => c.Name).OrderBy(n => n).ToList();

        missing.Should().BeEmpty(
            "every command that accepts external input must have a validator; missing: {0}",
            string.Join(", ", missing));
    }
}
