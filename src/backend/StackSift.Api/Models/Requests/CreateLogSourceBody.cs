using StackSift.Domain.Enums;

namespace StackSift.Api.Models.Requests;

/// <summary>Body for <c>POST /api/v1/projects/{id}/log-sources</c>.</summary>
/// <param name="Name">Log source display name (e.g. "prod-api-syslog").</param>
/// <param name="Type">Source type — drives the ingestion contract. See <see cref="LogSourceType"/>.</param>
public record CreateLogSourceBody(string Name, LogSourceType Type);
