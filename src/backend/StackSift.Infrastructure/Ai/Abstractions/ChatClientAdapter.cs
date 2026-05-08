using OpenAI.Chat;

namespace StackSift.Infrastructure.Ai.Abstractions;

internal sealed class ChatClientAdapter(ChatClient client) : IChatCompleter
{
    public async Task<ChatCompletion> CompleteChatAsync(
        IEnumerable<ChatMessage> messages,
        ChatCompletionOptions? options = null,
        CancellationToken cancellationToken = default)
    {
        var result = await client.CompleteChatAsync(messages, options, cancellationToken);
        return result.Value;
    }
}
