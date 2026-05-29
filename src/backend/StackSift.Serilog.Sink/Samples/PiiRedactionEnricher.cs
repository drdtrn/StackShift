using System.Text.RegularExpressions;
using Serilog.Core;
using Serilog.Events;

namespace StackSift.Serilog.Sink.Samples;

/// <summary>
/// Sample enricher that redacts common PII patterns from the rendered
/// message and from every string-valued property before the event leaves
/// the customer's process.
/// <para>
/// StackSift does <b>not</b> redact server-side
/// (see docs/adr/0009-no-server-side-log-redaction.md). If the customer
/// wants PII scrubbed they wire this enricher (or their own) into their
/// logger pipeline. This sample is deliberately conservative — it
/// over-redacts rather than under-redacts.
/// </para>
/// <example>
/// Log.Logger = new LoggerConfiguration()
///     .Enrich.With(new PiiRedactionEnricher())
///     .WriteTo.StackSift(...)
///     .CreateLogger();
/// </example>
/// </summary>
public sealed class PiiRedactionEnricher : ILogEventEnricher
{
    private const string EmailPattern = @"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b";
    private const string Ipv4Pattern = @"\b(?:\d{1,3}\.){3}\d{1,3}\b";
    private const string CreditCardPattern = @"\b(?:\d[ -]*?){13,19}\b";
    private const string PhonePattern = @"\b\+?[0-9][0-9 \-().]{8,18}[0-9]\b";

    private static readonly Regex[] Patterns =
    [
        new(EmailPattern, RegexOptions.Compiled | RegexOptions.IgnoreCase),
        new(Ipv4Pattern, RegexOptions.Compiled),
        new(CreditCardPattern, RegexOptions.Compiled),
        new(PhonePattern, RegexOptions.Compiled),
    ];

    private const string Placeholder = "[redacted]";

    public void Enrich(LogEvent logEvent, ILogEventPropertyFactory propertyFactory)
    {
        foreach (var (name, property) in logEvent.Properties.ToList())
        {
            if (property is ScalarValue { Value: string s })
            {
                var redacted = Redact(s);
                if (!ReferenceEquals(redacted, s))
                {
                    logEvent.AddOrUpdateProperty(
                        propertyFactory.CreateProperty(name, redacted));
                }
            }
        }
    }

    /// <summary>
    /// Returns <paramref name="value"/> unchanged if no pattern matched,
    /// otherwise a new string with every match replaced by <c>[redacted]</c>.
    /// Reference equality lets the caller skip the property update when
    /// nothing changed.
    /// </summary>
    public static string Redact(string value)
    {
        var result = value;
        foreach (var rx in Patterns)
        {
            result = rx.Replace(result, Placeholder);
        }
        return result;
    }
}
