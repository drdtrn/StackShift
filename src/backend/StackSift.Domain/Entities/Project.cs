using StackSift.Domain.Common;

namespace StackSift.Domain.Entities;

public class Project : AuditableEntity<Guid>
{
    public Guid OrganizationId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string Color { get; set; } = string.Empty;
}
