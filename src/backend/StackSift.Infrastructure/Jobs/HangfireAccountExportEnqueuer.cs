using Hangfire;
using StackSift.Application.Interfaces;

namespace StackSift.Infrastructure.Jobs;

internal sealed class HangfireAccountExportEnqueuer(IBackgroundJobClient jobs) : IAccountExportEnqueuer
{
    public void Enqueue(Guid requestId) =>
        jobs.Enqueue<IAccountExportJobRunner>(j => j.RunAsync(requestId, CancellationToken.None));
}
