using StackSift.Domain.Enums;

namespace StackSift.Application.DTOs;

public record LogSourceDto(
    Guid Id,
    Guid ProjectId,
    Guid OrganizationId,
    string Name,
    LogSourceType Type,
    string IngestUrl,
    string ApiKey,
    bool IsActive,
    DateTimeOffset? LastSeenAt,
    DateTimeOffset CreatedAt
);
