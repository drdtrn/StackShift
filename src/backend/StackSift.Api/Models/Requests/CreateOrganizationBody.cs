namespace StackSift.Api.Models.Requests;

/// <summary>Body for <c>POST /api/v1/organizations</c>.</summary>
/// <param name="Name">Organisation display name (2–50 chars, alphanumeric + spaces + hyphens; must start with a letter or digit).</param>
public record CreateOrganizationBody(string Name);
