namespace StackSift.Application.DTOs;

public record TestIngestResultDto(
    Guid SyntheticId,
    DateTimeOffset SentAt
);
