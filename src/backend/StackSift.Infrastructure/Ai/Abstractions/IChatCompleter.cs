using OpenAI.Chat;

namespace StackSift.Infrastructure.Ai.Abstractions;

public interface IChatCompleter
{
    Task<ChatCompletion> CompleteChatAsync(
        IEnumerable<ChatMessage> messages,
        ChatCompletionOptions? options = null,
        CancellationToken cancellationToken = default);
}
