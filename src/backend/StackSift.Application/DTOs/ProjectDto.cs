namespace StackSift.Application.DTOs;

public record ProjectDto(
    Guid Id,
    Guid OrganizationId,
    string Name,
    string Slug,
    string? Description,
    string Color,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt,
    int LogSourceCount,
    int ActiveIncidentCount
);
