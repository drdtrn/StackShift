using StackSift.Domain.Enums;

namespace StackSift.Application.DTOs;

public record MemberDto(
    Guid Id,
    string Email,
    string DisplayName,
    UserRole Role,
    Guid? InvitedByUserId,
    string? InvitedByDisplayName,
    DateTimeOffset CreatedAt,
    DateTimeOffset? LastLoginAt
);
