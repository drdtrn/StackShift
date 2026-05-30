using System.Net.Http.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using StackSift.Application.Interfaces;

namespace StackSift.Infrastructure.Captcha;

public sealed class TurnstileVerifier(
    HttpClient http,
    IOptions<CaptchaOptions> options,
    ILogger<TurnstileVerifier> logger) : ICaptchaVerifier
{
    private readonly CaptchaOptions _options = options.Value;

    public bool Enabled => !string.IsNullOrWhiteSpace(_options.SecretKey);

    public async Task<bool> VerifyAsync(string? token, string? remoteIp, CancellationToken ct = default)
    {
        if (!Enabled) return true;
        if (string.IsNullOrWhiteSpace(token)) return false;

        var form = new List<KeyValuePair<string, string>>
        {
            new("secret", _options.SecretKey!),
            new("response", token),
        };
        if (!string.IsNullOrWhiteSpace(remoteIp))
            form.Add(new("remoteip", remoteIp));

        try
        {
            var response = await http.PostAsync(_options.VerifyUrl, new FormUrlEncodedContent(form), ct);
            if (!response.IsSuccessStatusCode) return false;
            var result = await response.Content.ReadFromJsonAsync<TurnstileResponse>(ct);
            return result?.Success ?? false;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Turnstile verification request failed");
            return false;
        }
    }

    private sealed record TurnstileResponse(bool Success);
}
