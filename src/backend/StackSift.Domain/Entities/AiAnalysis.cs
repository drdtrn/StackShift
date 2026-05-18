using StackSift.Domain.Common;
using StackSift.Domain.Enums;

namespace StackSift.Domain.Entities;

public class AiAnalysis : AuditableEntity<Guid>
{
    public Guid IncidentId { get; set; }
    public Guid OrganizationId { get; set; }
    public AiAnalysisStatus Status { get; set; }
    public string? Summary { get; set; }
    public string? RootCause { get; set; }
    public List<string> SuggestedFixes { get; set; } = [];
    public List<Guid> RelevantLogIds { get; set; } = [];
    public float[]? Embedding { get; set; }
    public double? ConfidenceScore { get; set; }
    public DateTimeOffset? CompletedAt { get; set; }
}
