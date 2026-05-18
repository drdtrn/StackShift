namespace StackSift.Domain.ValueObjects;

public record EmailMessage(
    string To,
    string Subject,
    string HtmlBody,
    string? TextBody,
    string? CorrelationId
);
