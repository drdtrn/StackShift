using StackSift.Domain.Enums;

namespace StackSift.Application.DTOs;

public record InvitationDto(
    Guid Id,
    Guid OrganizationId,
    string Email,
    UserRole Role,
    Guid InvitedByUserId,
    DateTimeOffset ExpiresAt,
    DateTimeOffset CreatedAt
);
