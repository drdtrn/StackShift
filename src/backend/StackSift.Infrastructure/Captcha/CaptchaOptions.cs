namespace StackSift.Infrastructure.Captcha;

public sealed class CaptchaOptions
{
    public string? SecretKey { get; set; }
    public string VerifyUrl { get; set; } = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
}
