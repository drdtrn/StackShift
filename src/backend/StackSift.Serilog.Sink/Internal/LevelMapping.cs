using Serilog.Events;

namespace StackSift.Serilog.Sink.Internal;

internal static class LevelMapping
{
    public static string ToStackSift(LogEventLevel level) => level switch
    {
        LogEventLevel.Verbose => "Trace",
        LogEventLevel.Debug => "Debug",
        LogEventLevel.Information => "Info",
        LogEventLevel.Warning => "Warning",
        LogEventLevel.Error => "Error",
        LogEventLevel.Fatal => "Critical",
        _ => "Info",
    };
}
