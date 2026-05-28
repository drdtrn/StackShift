namespace StackSift.Infrastructure.Configuration;

public sealed record LogSourceOptions
{
    public string KeyPepperBase64 { get; init; } = string.Empty;
}
