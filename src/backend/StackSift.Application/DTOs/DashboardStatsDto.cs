namespace StackSift.Application.DTOs;

public record DashboardStatsDto(
    int ActiveAlertCount,
    long TotalLogsToday,
    int OpenIncidentCount
);
