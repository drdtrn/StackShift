namespace StackSift.Api.Models.Requests;

/// <summary>Body for <c>PUT /api/v1/projects/{id}</c>.</summary>
/// <param name="Name">Project display name (1–100 chars).</param>
/// <param name="Description">Optional free-form description (≤ 500 chars).</param>
/// <param name="Color">Hex colour for the project chip in the UI (e.g. <c>#3B82F6</c>).</param>
public record UpdateProjectBody(
    string Name,
    string? Description,
    string Color
);
