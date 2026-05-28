using System.Buffers;
using System.Text.Json;
using Serilog.Events;

namespace StackSift.Serilog.Sink.Internal;

internal static class PayloadBuilder
{
    private static readonly JsonWriterOptions WriterOptions = new() { Indented = false };

    public static byte[] Build(
        Guid projectId,
        Guid logSourceId,
        IReadOnlyList<LogEvent> events,
        string? serviceName,
        string? hostName)
    {
        var buffer = new ArrayBufferWriter<byte>(initialCapacity: 4 * 1024);
        using var writer = new Utf8JsonWriter(buffer, WriterOptions);

        writer.WriteStartObject();
        writer.WriteString("projectId", projectId);
        writer.WriteString("logSourceId", logSourceId);

        writer.WriteStartArray("entries");
        for (var i = 0; i < events.Count; i++)
        {
            WriteEntry(writer, events[i], serviceName, hostName);
        }
        writer.WriteEndArray();
        writer.WriteEndObject();
        writer.Flush();

        return buffer.WrittenSpan.ToArray();
    }

    private static void WriteEntry(
        Utf8JsonWriter writer,
        LogEvent evt,
        string? serviceName,
        string? hostName)
    {
        writer.WriteStartObject();
        writer.WriteString("level", LevelMapping.ToStackSift(evt.Level));
        writer.WriteString("message", evt.RenderMessage());
        writer.WriteString("timestamp", evt.Timestamp.ToString("O"));

        var traceId = ExtractScalar(evt, "TraceId") ?? evt.TraceId?.ToString();
        if (!string.IsNullOrEmpty(traceId))
            writer.WriteString("traceId", traceId);

        var spanId = ExtractScalar(evt, "SpanId") ?? evt.SpanId?.ToString();
        if (!string.IsNullOrEmpty(spanId))
            writer.WriteString("spanId", spanId);

        var resolvedService = serviceName ?? ExtractScalar(evt, "ServiceName");
        if (!string.IsNullOrEmpty(resolvedService))
            writer.WriteString("serviceName", resolvedService);

        var resolvedHost = hostName ?? ExtractScalar(evt, "HostName") ?? ExtractScalar(evt, "MachineName");
        if (!string.IsNullOrEmpty(resolvedHost))
            writer.WriteString("hostName", resolvedHost);

        WriteMetadata(writer, evt);
        writer.WriteEndObject();
    }

    private static void WriteMetadata(Utf8JsonWriter writer, LogEvent evt)
    {
        if (evt.Properties.Count == 0 && evt.Exception is null) return;

        writer.WriteStartObject("metadata");

        foreach (var (name, value) in evt.Properties)
        {
            if (IsReservedProperty(name)) continue;
            writer.WritePropertyName(JsonSafePropertyName(name));
            WritePropertyValue(writer, value);
        }

        if (evt.Exception is not null)
        {
            writer.WritePropertyName("exception");
            writer.WriteStartObject();
            writer.WriteString("type", evt.Exception.GetType().FullName ?? evt.Exception.GetType().Name);
            writer.WriteString("message", evt.Exception.Message);
            if (evt.Exception.StackTrace is not null)
                writer.WriteString("stackTrace", evt.Exception.StackTrace);
            writer.WriteEndObject();
        }

        writer.WriteEndObject();
    }

    private static bool IsReservedProperty(string name) =>
        name is "TraceId" or "SpanId" or "ServiceName" or "HostName" or "MachineName";

    private static string JsonSafePropertyName(string name) =>
        string.IsNullOrEmpty(name) ? "_" : name;

    private static string? ExtractScalar(LogEvent evt, string propertyName) =>
        evt.Properties.TryGetValue(propertyName, out var value) && value is ScalarValue { Value: { } v }
            ? v.ToString()
            : null;

    private static void WritePropertyValue(Utf8JsonWriter writer, LogEventPropertyValue value)
    {
        switch (value)
        {
            case ScalarValue scalar:
                WriteScalar(writer, scalar.Value);
                break;
            case SequenceValue sequence:
                writer.WriteStartArray();
                foreach (var item in sequence.Elements)
                    WritePropertyValue(writer, item);
                writer.WriteEndArray();
                break;
            case StructureValue structure:
                writer.WriteStartObject();
                foreach (var prop in structure.Properties)
                {
                    writer.WritePropertyName(JsonSafePropertyName(prop.Name));
                    WritePropertyValue(writer, prop.Value);
                }
                writer.WriteEndObject();
                break;
            case DictionaryValue dictionary:
                writer.WriteStartObject();
                foreach (var (key, dictValue) in dictionary.Elements)
                {
                    writer.WritePropertyName(JsonSafePropertyName(key.Value?.ToString() ?? "_"));
                    WritePropertyValue(writer, dictValue);
                }
                writer.WriteEndObject();
                break;
            default:
                writer.WriteStringValue(value.ToString());
                break;
        }
    }

    private static void WriteScalar(Utf8JsonWriter writer, object? value)
    {
        switch (value)
        {
            case null:
                writer.WriteNullValue();
                break;
            case bool b:
                writer.WriteBooleanValue(b);
                break;
            case string s:
                writer.WriteStringValue(s);
                break;
            case int i:
                writer.WriteNumberValue(i);
                break;
            case long l:
                writer.WriteNumberValue(l);
                break;
            case double d:
                writer.WriteNumberValue(d);
                break;
            case float f:
                writer.WriteNumberValue(f);
                break;
            case decimal m:
                writer.WriteNumberValue(m);
                break;
            case DateTime dt:
                writer.WriteStringValue(dt.ToString("O"));
                break;
            case DateTimeOffset dto:
                writer.WriteStringValue(dto.ToString("O"));
                break;
            case Guid g:
                writer.WriteStringValue(g);
                break;
            default:
                writer.WriteStringValue(value.ToString());
                break;
        }
    }
}
