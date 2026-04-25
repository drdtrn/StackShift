namespace StackSift.Api.Models.Requests;

public record UpdateProjectBody(
    string Name,
    string? Description,
    string Color
);