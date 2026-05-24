namespace StackSift.Infrastructure.Configuration;

public sealed class KeycloakAdminOptions
{
    public string RealmUrl { get; set; } = "";
    public string AdminBaseUrl { get; set; } = "";
    public string AdminClientId { get; set; } = "";
    public string AdminClientSecret { get; set; } = "";
}
