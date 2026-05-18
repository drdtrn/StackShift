namespace StackSift.Application.Messages;

public record EmailDeadLetterMessage(
    string To,
    string Subject,
    string HtmlBody,
    string? CorrelationId,
    DateTimeOffset FailedAt,
    string LastError
);
