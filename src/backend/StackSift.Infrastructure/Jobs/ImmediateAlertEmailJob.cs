using Elastic.Clients.Elasticsearch;
using Hangfire;
    using Microsoft.EntityFrameworkCore;
    using Microsoft.Extensions.Logging;
    using Microsoft.Extensions.Options;
    using StackSift.Domain.Enums;
    using StackSift.Domain.Interfaces;
    using StackSift.Domain.Interfaces.Repositories;
    using StackSift.Domain.ValueObjects;
    using StackSift.Infrastructure.Configuration;
    using StackSift.Infrastructure.Email;
    using StackSift.Infrastructure.Persistence;

namespace StackSift.Infrastructure.Jobs;

public sealed class ImmediateAlertEmailJob(
    AppDbContext db,
    IUserRepository users,
    IEmailService email,
    IOptions<AppOptions> appOptions,
    ILogger<ImmediateAlertEmailJob> logger,
    ICurrentOrgProvider orgProvider)
{
    public static readonly Dictionary<AlertSeverity, (string Bg, string Color)> Palette = new()
    {
        [AlertSeverity.Critical] = ("#fef2f2", "#dc2626"),
        [AlertSeverity.High] = ("#fff7ed", "#ea580c"),
        [AlertSeverity.Medium] = ("#fefce8", "#ca8a04"),
        [AlertSeverity.Low] = ("#f0f9ff", "#0284c7"),
    };
    
    [AutomaticRetry(Attempts = 3, DelaysInSeconds = new[] { 300, 300, 300 })]
    public async Task ExecuteAsync(Guid alertId, CancellationToken ct)
    {
        using var systemScope = orgProvider.EnterSystemScope(nameof(ImmediateAlertEmailJob));
        var alert = await db.Alerts.FirstOrDefaultAsync(a => a.Id == alertId, ct);
        if (alert is null)
        {
            logger.LogWarning("ImmediateAlertEmailJob: Alert {AlertId} not found — skipping", alertId);
            return;
        }

        var incident = alert.IncidentId is null
            ? null
            : await db.Incidents.FirstOrDefaultAsync(i => i.Id == alert.IncidentId.Value, ct);

        var admins = await users.GetAdminsByOrgIdAsync(alert.OrganizationId, ct);
        if (admins.Count == 0)
        {
            logger.LogInformation("ImmediateAlertEmailJob: org {OrgId} has no admins — skipping", alert.OrganizationId);
            return;
        }

        var (bg, color) = Palette.TryGetValue(alert.Severity, out var p) ? p : Palette[AlertSeverity.Medium];

        var template = MailKitEmailService.LoadTemplate("ImmediateAlert.html");

        var html = template
            .Replace("{{severity}}", alert.Severity.ToString().ToUpperInvariant())
            .Replace("{{severityBg}}", bg)
            .Replace("{{severityColor}}", color)
            .Replace("{{alertTitle}}", System.Net.WebUtility.HtmlEncode(alert.Title))
            .Replace("{{incidentTitle}}", System.Net.WebUtility.HtmlEncode(incident?.Title ?? "(no incident)"))
            .Replace("{{firedAt}}", alert.FiredAt.ToString("yyyy-MM-dd HH:mm:ss") + " UTC")
            .Replace("{{logMessages}}", """<tr><td style="padding:10px 16px;font-size:13px;color:#64748b;">View full log context in the dashboard.</td></tr>""")
            .Replace("{{incidentUrl}}", $"{appOptions.Value.FrontendBaseUrl}/incidents/{alert.IncidentId}");

        var subject = $"[{alert.Severity}] Alert fired: {alert.Title}";

        foreach (var admin in admins)
        {
            await email.SendAsync(new EmailMessage(
                To: admin.Email,
                Subject: subject,
                HtmlBody: html,
                TextBody: null,
                CorrelationId: $"alert-{alert.Id:N}"), ct);
        }
    }
}