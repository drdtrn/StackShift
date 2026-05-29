namespace StackSift.Api.Models.Requests;

/// <summary>Body for <c>DELETE /api/v1/account</c>.</summary>
/// <param name="Confirmation">Must equal the literal string <c>DELETE my account</c>.
/// Acts as the typed-confirmation gate against an XSS-driven request.</param>
public record DeleteAccountRequest(string Confirmation);

/// <summary>Body for <c>POST /api/v1/account/restore</c>.</summary>
/// <param name="Token">Single-use cancellation token returned by
/// <c>DELETE /api/v1/account</c>.</param>
public record RestoreAccountRequest(string Token);
