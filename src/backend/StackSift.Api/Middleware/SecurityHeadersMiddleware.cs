namespace StackSift.Api.Middleware;

public sealed class SecurityHeadersMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context)
    {
        var headers = context.Response.Headers;
        headers["X-Content-Type-Options"] = "nosniff";
        headers["X-Frame-Options"] = "DENY";
        headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
        headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=(), payment=(self)";
        headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains; preload";
        // The API serves JSON only; a default-deny CSP is safe and blocks framing.
        headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'";

        await next(context);
    }
}
