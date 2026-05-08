using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using OpenAI.Chat;
using StackSift.Domain.Exceptions;
using StackSift.Domain.Interfaces;
using StackSift.Domain.ValueObjects;
using StackSift.Infrastructure.Ai.Abstractions;
using StackSift.Infrastructure.Configuration;

namespace StackSift.Infrastructure.Ai;

public sealed class OpenAiAnalysisService(
    IChatCompleter chat,
    IOptions<OpenAiOptions> options,
    ILogger<OpenAiAnalysisService> logger) : IAiAnalysisService
{
    private readonly OpenAiOptions _opts = options.Value;

    private const string SystemPrompt = """
        You are StackSift's incident-analysis assistant. You help engineers diagnose the root
        cause of production incidents from raw log lines and from prior resolved incidents in
        the same project.

        You will receive:
        - The current incident's title, start time, and a concatenated log context.
        - Up to 3 past incidents in the SAME organisation that have been resolved, with each
          one's previous summary, root cause, and suggested fixes.

        Output STRICT JSON with this exact shape — no prose, no markdown, no code fences:
        {
          "summary": "<1-3 sentence explanation of what happened>",
          "rootCause": "<the most likely root cause, in plain English, naming specific
                        components / files / line numbers if visible in the logs>",
          "suggestedFixes": ["<actionable fix 1>", "<actionable fix 2>", ...],
          "confidenceScore": <number from 0.0 to 1.0>
        }

        Rules:
        - If the logs are insufficient for a root cause, say so honestly in `rootCause` and
          give a low `confidenceScore` (<= 0.3).
        - Reference past similar incidents when they help; if a past fix was a workaround
          rather than a root-cause fix, say so.
        - Each suggestedFixes entry should be ONE concrete action (config change, code fix,
          ops command). No multi-step paragraphs. 1-5 entries.
        - Do not invent file paths, line numbers, or version numbers that aren't in the logs.
        - confidenceScore is your honest self-assessment. 0.9 means "highly likely correct";
          0.3 means "speculative".
        """;

    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    public async Task<AiAnalysisResult> AnalyzeAsync(
        IncidentContext current,
        IReadOnlyList<SimilarIncident> similar,
        CancellationToken ct)
    {
        var userPrompt = BuildUserPrompt(current, similar);

        var chatOpts = new ChatCompletionOptions
        {
            ResponseFormat = ChatResponseFormat.CreateJsonObjectFormat(),
            MaxOutputTokenCount = 1_000,
            Temperature = _opts.Temperature,
        };

        var completion = await chat.CompleteChatAsync(
            messages:
            [
                new SystemChatMessage(SystemPrompt),
                new UserChatMessage(userPrompt),
            ],
            options: chatOpts,
            cancellationToken: ct);

        var raw = completion.Content[0].Text;
        logger.LogDebug("OpenAI chat response ({Len} chars): {Body}", raw.Length, raw);

        try
        {
            var parsed = JsonSerializer.Deserialize<RawResult>(raw, JsonOpts)
                ?? throw new AiAnalysisException("Empty JSON response from gpt-4o-mini.");

            if (string.IsNullOrWhiteSpace(parsed.RootCause))
                throw new AiAnalysisException("Missing rootCause in AI response.");

            var fixes = parsed.SuggestedFixes ?? [];
            var confidence = Math.Clamp(parsed.ConfidenceScore, 0.0, 1.0);

            return new AiAnalysisResult(
                Summary: parsed.Summary ?? string.Empty,
                RootCause: parsed.RootCause,
                SuggestedFixes: fixes,
                ConfidenceScore: confidence);
        }
        catch (JsonException ex)
        {
            throw new AiAnalysisException(
                $"Failed to parse gpt-4o-mini JSON response: {ex.Message}", ex);
        }
    }

    private static string BuildUserPrompt(IncidentContext current, IReadOnlyList<SimilarIncident> similar)
    {
        var sb = new StringBuilder(8_000);

        sb.AppendLine("## Current Incident");
        sb.AppendLine($"Title: {current.Title}");
        if (!string.IsNullOrWhiteSpace(current.Description))
            sb.AppendLine($"Description: {current.Description}");
        sb.AppendLine($"Started at: {current.StartedAt:O}");
        sb.AppendLine();
        sb.AppendLine("Logs (newest first):");
        sb.AppendLine("```");
        sb.AppendLine(current.ConcatenatedLogs);
        sb.AppendLine("```");
        sb.AppendLine();

        sb.AppendLine("## Similar Past Incidents (Resolved)");
        if (similar.Count == 0)
        {
            sb.AppendLine("(None — this is the first incident of its kind in this organisation.)");
        }
        else
        {
            for (var i = 0; i < similar.Count; i++)
            {
                var s = similar[i];
                sb.AppendLine($"### {i + 1}. {s.Title ?? "(untitled)"}");
                if (!string.IsNullOrWhiteSpace(s.Summary))
                    sb.AppendLine($"Summary: {s.Summary}");
                if (!string.IsNullOrWhiteSpace(s.RootCause))
                    sb.AppendLine($"Root cause: {s.RootCause}");
                if (s.SuggestedFixes.Count > 0)
                {
                    sb.AppendLine("Fixes that were suggested:");
                    foreach (var fix in s.SuggestedFixes)
                        sb.AppendLine($"- {fix}");
                }
                sb.AppendLine();
            }
        }

        return sb.ToString();
    }

    private sealed record RawResult(
        string? Summary,
        string? RootCause,
        IReadOnlyList<string>? SuggestedFixes,
        double ConfidenceScore);
}
