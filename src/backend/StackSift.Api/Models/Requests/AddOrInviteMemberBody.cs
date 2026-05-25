using StackSift.Domain.Enums;

namespace StackSift.Api.Models.Requests;

/// <summary>Body for <c>POST /api/v1/organizations/{orgId}/members</c>.</summary>
/// <param name="Email">Prospective member's email address (lower-cased + trimmed server-side).</param>
/// <param name="Role">Role to grant on attach / save on the invitation. Any of owner/admin/member/viewer.</param>
public record AddOrInviteMemberBody(string Email, UserRole Role);
