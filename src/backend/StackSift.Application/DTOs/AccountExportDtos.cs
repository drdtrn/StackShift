using StackSift.Domain.Enums;

namespace StackSift.Application.DTOs;

public sealed record AccountExportRequestDto(
    Guid RequestId,
    AccountExportStatus Status,
    DateTimeOffset RequestedAt,
    DateTimeOffset? CompletedAt,
    DateTimeOffset? ExpiresAt,
    string? SignedUrl,
    long? SizeBytes,
    string? ManifestSha256);

public sealed record AccountExportSummaryDto(
    Guid RequestId,
    AccountExportStatus Status,
    DateTimeOffset RequestedAt,
    DateTimeOffset? CompletedAt,
    DateTimeOffset? ExpiresAt);
