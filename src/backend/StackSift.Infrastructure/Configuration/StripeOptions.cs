namespace StackSift.Infrastructure.Configuration;

public sealed class StripeOptions
{
    public string ApiKey { get; set; } = string.Empty;
    public string WebhookSecret { get; set; } = string.Empty;
    public StripePricesOptions Prices { get; set; } = new();
    public string CheckoutSuccessUrl { get; set; } = string.Empty;
    public string CheckoutCancelUrl { get; set; } = string.Empty;
    public string PortalReturnUrl { get; set; } = string.Empty;
}

public sealed class StripePricesOptions
{
    public string Indie { get; set; } = string.Empty;
    public string Team { get; set; } = string.Empty;
}
