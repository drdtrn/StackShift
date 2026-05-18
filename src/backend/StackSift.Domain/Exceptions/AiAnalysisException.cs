namespace StackSift.Domain.Exceptions;

public sealed class AiAnalysisException(string message, Exception? inner = null)
    : Exception(message, inner);
