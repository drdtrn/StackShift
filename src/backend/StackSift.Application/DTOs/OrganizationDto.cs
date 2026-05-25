using StackSift.Domain.Enums;

namespace StackSift.Application.DTOs;

public record OrganizationDto(
    Guid Id,
    string Name,
    string Slug,
    string? LogoUrl,
    Plan Plan,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);
