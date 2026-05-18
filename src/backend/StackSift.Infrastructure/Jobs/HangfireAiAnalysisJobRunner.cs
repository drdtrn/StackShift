using Hangfire;
using StackSift.Application.Interfaces;

namespace StackSift.Infrastructure.Jobs;

internal sealed class HangfireAiAnalysisJobRunner(IBackgroundJobClient jobs) : IAiAnalysisJobRunner
{
    public void Enqueue(Guid analysisId) =>
        jobs.Enqueue<RunAiAnalysisJob>(j => j.ExecuteAsync(analysisId, CancellationToken.None));
}
