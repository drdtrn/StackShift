using StackSift.Domain.Enums;
using StackSift.Domain.ValueObjects;

namespace StackSift.Application.Interfaces;

public interface IMemberEmailComposer
{
    EmailMessage BuildMemberAdded(string toEmail, string organizationName, UserRole role);

    EmailMessage BuildInvitation(
        string toEmail,
        string inviterDisplayName,
        string organizationName,
        UserRole role,
        string token,
        DateTimeOffset expiresAt);
}
