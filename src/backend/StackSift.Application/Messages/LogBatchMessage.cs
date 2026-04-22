using StackSift.Application.DTOs;

namespace StackSift.Application.Messages;

public record LogBatchMessage(
    Guid OrganizationId,
    Guid ProjectId,
    Guid LogSourceId,
    List<IngestLogEntryDto> Entries
);
