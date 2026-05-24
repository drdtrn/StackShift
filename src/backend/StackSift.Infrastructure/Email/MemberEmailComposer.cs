using Microsoft.Extensions.Options;
using StackSift.Application.Interfaces;
using StackSift.Domain.Enums;
using StackSift.Domain.ValueObjects;
using StackSift.Infrastructure.Configuration;

namespace StackSift.Infrastructure.Email;

public sealed class MemberEmailComposer(IOptions<AppOptions> appOptions) : IMemberEmailComposer
{
    private readonly string _appUrl = appOptions.Value.FrontendBaseUrl.TrimEnd('/');

    public EmailMessage BuildMemberAdded(string toEmail, string organizationName, UserRole role)
    {
        var template = MailKitEmailService.LoadTemplate("MemberAdded.html");
        var html = template
            .Replace("{{orgName}}", HtmlEscape(organizationName))
            .Replace("{{role}}", role.ToString())
            .Replace("{{appUrl}}", _appUrl);

        var subject = $"You've been added to {organizationName} on StackSift";
        var text = $"You've been added to {organizationName} as {role}. Open StackSift: {_appUrl}/";

        return new EmailMessage(toEmail, subject, html, text, CorrelationId: null);
    }

    public EmailMessage BuildInvitation(
        string toEmail,
        string inviterDisplayName,
        string organizationName,
        UserRole role,
        string token,
        DateTimeOffset expiresAt)
    {
        var acceptUrl = $"{_appUrl}/accept-invitation?token={Uri.EscapeDataString(token)}";
        var expiresFormatted = expiresAt.UtcDateTime.ToString("u");

        var template = MailKitEmailService.LoadTemplate("Invitation.html");
        var html = template
            .Replace("{{orgName}}", HtmlEscape(organizationName))
            .Replace("{{inviter}}", HtmlEscape(inviterDisplayName))
            .Replace("{{role}}", role.ToString())
            .Replace("{{acceptUrl}}", acceptUrl)
            .Replace("{{expiresAt}}", expiresFormatted);

        var subject = $"{inviterDisplayName} invited you to {organizationName} on StackSift";
        var text = $"{inviterDisplayName} invited you to join {organizationName} as {role}.\n" +
                   $"Accept: {acceptUrl}\n" +
                   $"Expires: {expiresFormatted}";

        return new EmailMessage(toEmail, subject, html, text, CorrelationId: null);
    }

    private static string HtmlEscape(string s) =>
        s.Replace("&", "&amp;").Replace("<", "&lt;").Replace(">", "&gt;");
}
