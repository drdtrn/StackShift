using StackSift.Domain.Enums;

namespace StackSift.Api.Models.Requests;

/// <summary>Body for <c>PATCH /api/v1/organizations/{orgId}/members/{userId}</c>.</summary>
/// <param name="Role">The new role to assign. Any of owner/admin/member/viewer.</param>
public record UpdateMemberRoleBody(UserRole Role);
