namespace StackSift.Application.DTOs;

public record LogSourceCreatedDto(
    LogSourceDto LogSource,
    string ApiKey
);
