# CSRF decision (Plan 08 §12)

**Decision: no anti-forgery (double-submit) token for the v1 surface.**

## Why classical CSRF does not apply

State-changing requests in StackSift are not driven by an ambient cookie:

- The dashboard calls the .NET API with `Authorization: Bearer <token>` (the
  token is fetched server-side from the HTTP-only session cookie and attached by
  the API client). A cross-site page cannot read that token or force the browser
  to attach it.
- The session cookie (`stacksift_session`) is `HttpOnly; SameSite=Lax; Secure`.
  `SameSite=Lax` allows the cookie on top-level GET navigations only — and every
  BFF GET route handler (`/api/auth/me`, `/api/auth/bearer`, `/api/auth/refresh`
  read paths) is side-effect-free.
- CORS is restricted to an explicit origin allowlist (no wildcards in
  production), so a third-party origin cannot make a credentialed cross-origin
  call that the browser will expose.
- The Stripe webhook authenticates by signature, not by cookie.

## What would change this

Add a CSRF token if we ever introduce a **cookie-authenticated, same-origin,
state-changing** endpoint (for example a future `POST /api/auth/forgot-password`
submitted as a same-origin form rather than a Bearer XHR). In that case use the
standard pattern: token in a `<meta>` tag / non-HttpOnly cookie, verified on the
POST. Until then a double-submit token adds ceremony without closing a real gap.

## Reviewer checklist

- New mutating endpoint that relies on the session cookie (not Bearer)? → add CSRF protection.
- New `SameSite` relaxation on the session cookie? → re-evaluate this decision.
