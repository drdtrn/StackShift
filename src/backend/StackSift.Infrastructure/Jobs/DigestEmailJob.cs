using System.Text;
using Hangfire;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using StackSift.Domain.Entities;
using StackSift.Domain.Enums;
using StackSift.Domain.Interfaces;
using StackSift.Domain.Interfaces.Repositories;
using StackSift.Domain.ValueObjects;
using StackSift.Infrastructure.Configuration;
using StackSift.Infrastructure.Email;

namespace StackSift.Infrastructure.Jobs;

public sealed class DigestEmailJob(
    IIncidentRepository incidents,
    IUserRepository users,
    IEmailService email,
    IOptions<AppOptions> appOptions,
    ILogger<DigestEmailJob> logger)
{
    [AutomaticRetry(Attempts = 3, DelaysInSeconds = new[] { 3600, 3600, 3600 })]
    public async Task ExecuteAsync(CancellationToken ct)
    {
        var since = DateTimeOffset.UtcNow.AddDays(-1);
        var orgIds = await incidents.GetOrganizationIdsWithIncidentsSinceAsync(since, ct);

        logger.LogInformation("DigestEmailJob: {OrgCount} orgs have incidents since {Since}", orgIds.Count, since);

        var template = MailKitEmailService.LoadTemplate("DailyDigest.html");
        var dashboardUrl = appOptions.Value.FrontendBaseUrl + "/dashboard";

        foreach (var orgId in orgIds)
        {
            var orgIncidents = await incidents.GetCreatedSinceByOrgIdAsync(orgId, since, ct);
            var admins = await users.GetAdminsByOrgIdAsync(orgId, ct);
            if (admins.Count == 0) continue;

            var html = template
                .Replace("{{date}}", since.ToString("yyyy-MM-dd"))
                .Replace("{{totalIncidents}}", orgIncidents.Count.ToString())
                .Replace("{{criticalCount}}", orgIncidents.Count(i => i.Severity == AlertSeverity.Critical).ToString())
                .Replace("{{highCount}}", orgIncidents.Count(i => i.Severity == AlertSeverity.High).ToString())
                .Replace("{{incidentRows}}", BuildIncidentRows(orgIncidents))
                .Replace("{{dashboardUrl}}", dashboardUrl);

            var subject = $"StackSift Daily Digest — {since:yyyy-MM-dd}";

            foreach (var admin in admins)
            {
                await email.SendAsync(new EmailMessage(
                    To: admin.Email,
                    Subject: subject,
                    HtmlBody: html,
                    TextBody: null,
                    CorrelationId: $"digest-{orgId:N}"), ct);
            }
        }
    }

    private static string BuildIncidentRows(IReadOnlyList<Incident> list)
    {
        if (list.Count == 0)
            return """<tr><td colspan="4" style="padding:12px;font-size:13px;color:#94a3b8;">No incidents in the last 24 hours.</td></tr>""";

        var sb = new StringBuilder();
        foreach (var i in list)
        {
            sb.Append("<tr>")
                .Append($"""<td style="padding:10px 12px;font-size:13px;color:#0f172a;">{System.Net.WebUtility.HtmlEncode(i.Title)}</td>""")
                .Append($"""<td style="padding:10px 12px;font-size:13px;color:#475569;">{i.Severity}</td>""")
                .Append($"""<td style="padding:10px 12px;font-size:13px;color:#475569;">{i.Status}</td>""")
                .Append($"""<td style="padding:10px 12px;font-size:13px;color:#475569;">{i.StartedAt:yyyy-MM-dd HH:mm} UTC</td>""")
                .Append("</tr>");
        }
        return sb.ToString();
    }
}