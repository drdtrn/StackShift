using StackSift.Domain.Enums;

namespace StackSift.Api.Models.Requests;

/// <summary>Body for <c>PATCH /api/v1/incidents/{id}/status</c>.</summary>
/// <param name="Status">Target status. Allowed transitions: Open→Acknowledged, Acknowledged→Resolved, Open→Resolved.</param>
public record UpdateIncidentStatusBody(IncidentStatus Status);
