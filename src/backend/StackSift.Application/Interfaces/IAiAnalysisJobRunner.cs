namespace StackSift.Application.Interfaces;

public interface IAiAnalysisJobRunner
{
    void Enqueue(Guid analysisId);
}
