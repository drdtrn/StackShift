using System.ClientModel.Primitives;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Moq;
using OpenAI.Chat;
using StackSift.Domain.Exceptions;
using StackSift.Domain.ValueObjects;
using StackSift.Infrastructure.Ai;
using StackSift.Infrastructure.Ai.Abstractions;
using StackSift.Infrastructure.Configuration;

namespace StackSift.Tests.Infrastructure.Ai;

public class OpenAiAnalysisServiceTests
{
    private static readonly IOptions<OpenAiOptions> DefaultOpts =
        Options.Create(new OpenAiOptions());

    [Fact]
    public async Task AnalyzeAsync_ParsesValidJsonResponse()
    {
        var chat = MockChatReturning("""
            {
              "summary": "Redis ran out of memory.",
              "rootCause": "maxmemory-policy=noeviction caused new connections to be refused.",
              "suggestedFixes": ["Set maxmemory-policy to allkeys-lru"],
              "confidenceScore": 0.85
            }
            """);

        var sut = new OpenAiAnalysisService(chat, DefaultOpts, NullLogger<OpenAiAnalysisService>.Instance);

        var result = await sut.AnalyzeAsync(SampleContext(), [], CancellationToken.None);

        Assert.Equal("Redis ran out of memory.", result.Summary);
        Assert.Single(result.SuggestedFixes);
        Assert.Equal(0.85, result.ConfidenceScore);
    }

    [Fact]
    public async Task AnalyzeAsync_ThrowsOnInvalidJson()
    {
        var chat = MockChatReturning("not actually json");
        var sut = new OpenAiAnalysisService(chat, DefaultOpts, NullLogger<OpenAiAnalysisService>.Instance);

        await Assert.ThrowsAsync<AiAnalysisException>(() =>
            sut.AnalyzeAsync(SampleContext(), [], CancellationToken.None));
    }

    [Fact]
    public async Task AnalyzeAsync_ThrowsWhenRootCauseMissing()
    {
        var chat = MockChatReturning("""{"summary":"x","suggestedFixes":[],"confidenceScore":0.1}""");
        var sut = new OpenAiAnalysisService(chat, DefaultOpts, NullLogger<OpenAiAnalysisService>.Instance);

        await Assert.ThrowsAsync<AiAnalysisException>(() =>
            sut.AnalyzeAsync(SampleContext(), [], CancellationToken.None));
    }

    [Fact]
    public async Task AnalyzeAsync_ClampsConfidenceOutOfRange()
    {
        var chat = MockChatReturning("""
            {
              "summary": "test",
              "rootCause": "test cause",
              "suggestedFixes": [],
              "confidenceScore": 1.5
            }
            """);

        var sut = new OpenAiAnalysisService(chat, DefaultOpts, NullLogger<OpenAiAnalysisService>.Instance);

        var result = await sut.AnalyzeAsync(SampleContext(), [], CancellationToken.None);

        Assert.Equal(1.0, result.ConfidenceScore);
    }

    private static IncidentContext SampleContext() => new(
        IncidentId: Guid.NewGuid(),
        Title: "Test incident",
        Description: null,
        StartedAt: DateTimeOffset.UtcNow,
        ConcatenatedLogs: "log1\nlog2",
        ContributingLogIds: []);

    private static IChatCompleter MockChatReturning(string jsonContent)
    {
        var completionJson = $$"""
            {
              "id": "chatcmpl-test",
              "object": "chat.completion",
              "created": 1234567890,
              "model": "gpt-4o-mini",
              "choices": [
                {
                  "index": 0,
                  "message": {
                    "role": "assistant",
                    "content": {{System.Text.Json.JsonSerializer.Serialize(jsonContent)}}
                  },
                  "finish_reason": "stop"
                }
              ],
              "usage": {
                "prompt_tokens": 100,
                "completion_tokens": 50,
                "total_tokens": 150
              }
            }
            """;

        var completion = ModelReaderWriter.Read<ChatCompletion>(
            BinaryData.FromString(completionJson))!;

        var mock = new Mock<IChatCompleter>();
        mock.Setup(c => c.CompleteChatAsync(
                It.IsAny<IEnumerable<ChatMessage>>(),
                It.IsAny<ChatCompletionOptions>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(completion);

        return mock.Object;
    }
}
