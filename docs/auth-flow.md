# Auth Flow — BFF Cookie Pattern

StackSift uses a **Backend-For-Frontend (BFF)** auth pattern. The Next.js app owns the session; the browser never sees a raw JWT.

---

## 1. Architecture

```
Browser                  Next.js BFF (route handlers)        Keycloak          .NET API
  │                              │                               │                 │
  │── GET /login ───────────────>│                               │                 │
  │                              │── redirect (/auth?pkce) ────>│                 │
  │<─────────────────────────────│── 302 to Keycloak login ─────│                 │
  │                              │                               │                 │
  │── submit credentials ───────────────────────────────────────>│                 │
  │<── 302 /api/auth/callback?code=… ─────────────────────────────                │
  │                              │                               │                 │
  │── GET /api/auth/callback ───>│                               │                 │
  │                              │── POST /token (PKCE exchange)>│                 │
  │                              │<── { access_token, … } ──────│                 │
  │                              │  writes stacksift_session     │                 │
  │<── 302 / (Set-Cookie) ───────│  cookie (HttpOnly)            │                 │
  │                              │                               │                 │
  │── GET /api/auth/me ─────────>│ (cookie travels automatically)│                 │
  │<── 200 { user } ────────────│                               │                 │
  │                              │                               │                 │
  │── GET /api/auth/token ──────>│                               │                 │
  │<── 200 { accessToken } ─────│  (JS can read the token here) │                 │
  │                              │                               │                 │
  │── apiClient.get('/api/v1/…') ──────────────────────────────────── Bearer ────>│
  │<─────────────────────────────────────────────────────────────────── 200 ──────│
```

The `stacksift_session` cookie is **HttpOnly** — JavaScript cannot read it directly. `/api/auth/token` is the safe bridge that hands just the access-token string to JS (for SignalR and REST calls).

---

## 2. Cookie lifecycle

| Event | Cookie action |
|---|---|
| Successful callback | `Set-Cookie: stacksift_session=…; HttpOnly; SameSite=Lax; Path=/; Max-Age=86400` |
| `/api/auth/token` or `/api/auth/me` on expiry | Cookie rotated in-place with refreshed tokens |
| Refresh token expired / revoked | Cookie cleared (`Max-Age=0`), caller receives 401 |
| Logout | Cookie cleared, user redirected through Keycloak `end_session_endpoint` |

Attributes:
- **`HttpOnly`** — inaccessible to JavaScript; eliminates XSS token theft.
- **`SameSite=Lax`** — sent on top-level navigations (Keycloak redirect back) but not on cross-site sub-requests (CSRF protection).
- **`Secure`** — added automatically in `NODE_ENV=production`.
- **`Path=/`** — cookie is sent with every request to this origin.

---

## 3. Mock mode

Set `NEXT_PUBLIC_AUTH_MOCK=true` in `.env.local` to bypass all Keycloak calls.

| Flag | Behaviour |
|---|---|
| `NEXT_PUBLIC_AUTH_MOCK=true` | Auto-login as **Alice Nguyen** (owner, existing org). No Docker required. |
| `NEXT_PUBLIC_AUTH_MOCK_NEW_USER=true` | Same, but Alice has no `organizationId` — exercises the onboarding wizard. |

Mock tokens are unsigned JWTs (`mock-signature` segment) — they decode correctly in `/api/auth/me` and `/api/auth/token` using the same `extractUserFromToken` logic as real tokens.

---

## 4. Seeded Keycloak users

After realm import, two users exist:

| Username | Email | Role | Org ID |
|---|---|---|---|
| `admin-user` | `admin@stacksift.local` | `admin` | `11111111-1111-1111-1111-111111111111` |
| `viewer-user` | `viewer@stacksift.local` | `viewer` | `11111111-1111-1111-1111-111111111111` |

The realm ships with argon2-hashed passwords (not in plain text). **Reset them after each fresh `docker compose down -v`:**

1. Browse to `http://localhost:8080`, log in as `admin / admin_secret`.
2. Switch to the **stacksift** realm.
3. **Users → admin-user → Credentials → Reset password** → set `password123`, un-tick "Temporary" → Save.
4. Repeat for `viewer-user`.

Chosen team password: **`password123`** (dev only — never used in production).

---

## 5. Realm reimport gotcha

```
docker compose restart keycloak   ← does NOT reimport (realm already in Postgres)
docker compose down -v            ← wipes Postgres → forces reimport on next up
docker compose up -d              ← first boot imports the realm JSON
```

The `--import-realm` flag is idempotent — if the `stacksift` realm already exists in Postgres, Keycloak skips the import silently.

---

## 5b. WebSocket authentication (SignalR)

The SignalR hub at `/hubs/stacksift` cannot receive a custom `Authorization` header (browsers don't allow it on the WebSocket upgrade). The backend reads the JWT from the `?access_token=` query string instead — see `Program.cs` `JwtBearerEvents.OnMessageReceived`, gated to paths under `/hubs`.

On the client, `useSignalR`'s `accessTokenFactory` fetches the token from `/api/auth/token`, which silent-refreshes the session cookie if expired. `accessTokenFactory` runs per-connection (not per-message), so a mid-connection token expiry forces a reconnect — `withAutomaticReconnect` handles the retry, picking up a fresh token on the next `accessTokenFactory` invocation.

Cross-tenant guard: `AlertHub.JoinProjectGroup` does a real repository lookup; a `NotFoundException` (project not in caller's org) is mapped to `HubException("Forbidden")`. The client maps that to a toast and clears `useUIStore.activeProjectId` rather than logging the user out — the JWT itself is still valid.

---

## 6. Manual smoke-test checklist

Run this before opening the FS-02 PR and before any demo rehearsal:

```
[ ] cd infrastructure/docker && docker compose down -v && docker compose up -d
[ ] docker compose logs -f keycloak | grep -i "import"
    → expect: "Imported realm stacksift from file …"
[ ] curl -s http://localhost:8080/realms/stacksift/.well-known/openid-configuration | jq .issuer
    → expect: "http://localhost:8080/realms/stacksift"
[ ] Reset admin-user + viewer-user passwords via admin UI (see § 4)
[ ] pnpm dev  (NEXT_PUBLIC_AUTH_MOCK=false in .env.local)
[ ] Click "Sign in" → Keycloak form → submit admin-user / password123 → land on /
[ ] DevTools → Application → Cookies:
    stacksift_session = present, HttpOnly=✓, SameSite=Lax
[ ] Decode the token via /api/auth/token (DevTools console):
    fetch('/api/auth/token').then(r=>r.json()).then(console.log)
    → expect { accessToken: 'eyJ…' }
[ ] Paste JWT into jwt.io → confirm claims: sub, email, stacksift_role, organization_id, aud=[…stacksift-api…]
[ ] Keycloak admin UI → Realm settings → Tokens → Access Token Lifespan = 1 minute → Save
[ ] Wait 90 s, call /api/auth/token again → expect 200 + different JWT + cookie updated
[ ] Restore Access Token Lifespan = 5 minutes → Save
[ ] Click Sign out → cookie cleared, redirect to /login
[ ] Flip NEXT_PUBLIC_AUTH_MOCK=true → sign in → confirm Alice Nguyen (regression check)
```

---

## 7. ROPC + backend admin client (NUF-1)

The New-User-Flow series adds two pieces that bypass the hosted Keycloak login page:

1. **Direct Access Grants (ROPC)** on the `stacksift-frontend` client — so the in-app login + register forms (NUF-3) can post `{email, password}` straight to `/protocol/openid-connect/token`, get tokens, and hand them to the BFF cookie machinery without a redirect.
2. **A confidential `stacksift-backend-admin` service-account client** — used by the .NET backend (and *only* the .NET backend) to call `/admin/realms/stacksift/users` for registration (NUF-2) and member-management (NUF-5). The admin secret never reaches the browser.

### 7.1 Reimport gotcha (same as §5, called out again)

Realm-config changes only take effect after a volume wipe:

```
cd infrastructure/docker
docker compose down -v && docker compose up -d
```

Then reset the two seeded users' passwords per §4. The auto-generated `stacksift-backend-admin` secret is visible in the Keycloak UI: **Clients → stacksift-backend-admin → Credentials → Client secret**.

### 7.2 Configuring the .NET backend

Copy the secret into `dotnet user-secrets` for local dev:

```bash
cd src/backend/StackSift.Api
dotnet user-secrets set "Keycloak:Admin:AdminClientSecret" "<paste from Keycloak UI>"
```

For docker-compose runs of the backend, pass it as an env var (`Keycloak__Admin__AdminClientSecret=…`). The placeholder lives in `infrastructure/docker/.env.example`.

### 7.3 Why a separate client for admin calls?

- The service account has narrow scope: `manage-users`, `view-users`, `query-users` on `realm-management` and nothing else. Frontend clients never see this scope.
- The secret is confidential; rotating it doesn't invalidate user sessions.
- `IKeycloakAdminClient` (Application layer) is the only path to the Keycloak admin REST API — controllers and handlers must never call Keycloak directly. The interface keeps the Clean Architecture order intact.

### 7.4 ROPC test surface

`KeycloakAdminClientIntegrationTests` spins up a Testcontainers Keycloak, provisions the admin client via `KeycloakTestRealmSeeder` (auto-generated secret is read back from `/clients/{uuid}/client-secret`), then exercises create → ROPC-login → JWT-claims round-trip. Tokens still flow through the existing `KeycloakTokenClient` (which uses the `stacksift-api-test` client's direct-grant flow).

---

## 8. Registration (NUF-2)

`POST /api/v1/auth/register` is the only anonymous mutation in the API. The .NET backend owns it end-to-end — the Next.js BFF (NUF-3) is a thin pass-through so the admin client secret never reaches the browser.

```
Browser            Next.js BFF                .NET API                    Keycloak admin              DB
  │                     │                         │                            │                       │
  │── POST /api/auth ──>│                         │                            │                       │
  │    /register form   │                         │                            │                       │
  │                     │── POST /api/v1/auth ───>│                            │                       │
  │                     │    /register            │                            │                       │
  │                     │                         │── FindPendingByEmail ─────────────────────────────>│
  │                     │                         │<── Invitation? ────────────────────────────────────│
  │                     │                         │── CreateUserAsync ────────>│                       │
  │                     │                         │<── new user UUID ──────────│                       │
  │                     │                         │── Users.Add + Invitation.AcceptedAt + SaveChanges >│
  │                     │                         │<───────────────────────────────────────────────────│
  │                     │<── 201 RegisterUserResult ──                          │                       │
  │<── 201 ─────────────│                         │                            │                       │
  │                     │                         │                            │                       │
  │── POST /api/auth ──>│                         │                            │                       │
  │    /login (ROPC)    │── POST /token ─────────────────────────────────────>│                       │
  │                     │<── { access_token, … } ───────────────────────────────                       │
  │<── 302 / ───────────│  Set-Cookie: session    │                            │                       │
```

### 8.1 Invitation auto-attach

If a pending, non-expired `Invitation` matches the submitted email (case-insensitive), the handler **uses the invitation's role + organisation, discarding the form's `isOwner` flag**. The invitation row's `AcceptedAt` is stamped in the same transaction. This is the bridge that lets owners on-board members by email alone (see NUF-5).

If `isOwner: true` was submitted but an invitation matched, the user becomes a member of the inviting org with the invitation's role — they do **not** become an owner of a brand-new org. The frontend (NUF-3) doesn't need to guard against this because the result body's `attachedViaInvitation: true` + non-null `organizationId` tell it to route the user to `/` rather than `/onboarding`.

### 8.2 Compensation on DB failure

The handler creates the Keycloak user first, then writes the `Users` row. If `SaveChangesAsync` throws, the compensating call to `IKeycloakAdminClient.DeleteUserAsync` runs with `CancellationToken.None` so it survives a request cancellation; failures are logged at `Error` so an orphan can be reconciled manually. Verified by `DbFailure_RollsBackKeycloakUser`.

### 8.3 Rate limit

5 registrations per `RemoteIpAddress` per 10 minutes (fixed window). The `OnRejected` handler is the shared one — 429 with a `Retry-After` header and a `ProblemDetails` body.

---

## 9. In-app login + register forms (NUF-3)

The frontend now drives the entire login/register flow without redirecting to the Keycloak-hosted page. The legacy GET `/api/auth/login` redirect (Google SSO + PKCE) is kept for SSO and any caller that still expects a redirect.

### 9.1 ROPC sign-in sequence

```
Browser            Next.js BFF                       Keycloak
  │                     │                                │
  │── submit form ─────>│  POST /api/auth/login          │
  │   {email, pwd}      │  Zod parse loginSchema         │
  │                     │── POST /token ────────────────>│
  │                     │   grant_type=password          │
  │                     │   client_id=stacksift-frontend │
  │                     │   username/password/scope      │
  │                     │<── 200 { access_token, … } ────│
  │                     │  createSessionCookie(tokens)   │
  │<── 200 ─────────────│  Set-Cookie: stacksift_session │
  │   ok: true          │                                │
  │                     │                                │
  │── router.replace(next) ─> client renders dashboard
```

- 401 from Keycloak → BFF returns `401 invalid_credentials`. The form shows a single "Invalid email or password" toast — no distinction between "wrong email" vs "wrong password" (avoids account enumeration).
- 400/503/network failure → `502 upstream_error` / `502 upstream_unreachable`. Generic toast; the form stays usable.

### 9.2 Register sequence (with auto-attach)

```
Browser            Next.js BFF                       .NET API                       Keycloak
  │                     │                                │                              │
  │── submit form ─────>│  POST /api/auth/register       │                              │
  │  {email,pwd,        │  Zod parse registerSchema      │                              │
  │   displayName,role} │── POST /api/v1/auth/register ─>│                              │
  │                     │   { isOwner: role==='owner' }  │                              │
  │                     │                                │ pending invitation? attach.  │
  │                     │                                │ else use form role.          │
  │                     │                                │── CreateUserAsync ──────────>│
  │                     │                                │<── new user UUID ────────────│
  │                     │<── 201 RegisterUserResult ─────│  Users.Add + (Invitation.    │
  │                     │   { attachedViaInvitation, … } │   AcceptedAt if matched)     │
  │<── 201 ─────────────│                                │                              │
  │                     │                                │                              │
  │── POST /api/auth/login ──────────> (ROPC path above) ────────────────────────────────
  │
  │── router.replace decided by RESPONSE:
  │   attachedViaInvitation: true  → "/"
  │   role: "owner"                → "/onboarding"
  │   otherwise                    → "/waiting"
```

The frontend never inspects the form's `role` field to pick the redirect — it inspects the registration *response*. This is what makes the NUF-2 "invitations win" rule visible at the call site.

### 9.3 What changed in the (auth) route group

- New `/landing` — the canonical "you're not signed in" page; `AuthGuard` redirects unauthenticated visitors here (was `/login`).
- New `/register` — RHF + Zod form, owner-or-viewer radio.
- New `/waiting` — stub for non-owner registrants without an org (full polling lands in NUF-4).
- `/login` rewritten as a real POST form; the marketing-funnel `?plan=&from=` logic still resolves to `/billing/checkout?...` for the post-login redirect.
- `/login/forgot` — a coming-soon stub so the "Forgot password?" link never 404s.

### 9.4 No new mock-mode work

`NEXT_PUBLIC_AUTH_MOCK=true` continues to drive the *legacy* GET-redirect path (Alice auto-login) but the new POST handlers don't have a mock branch. Offline dev for the new forms requires `docker compose up -d`. The component tests stub `global.fetch` and the route-handler tests stub the Keycloak / .NET upstreams — neither leans on a mock-user store.

---

## 10. Four-state post-auth routing (NUF-4)

`OrgGuard` (renamed from `OnboardingGuard`) plus the server-side redirect in `(dashboard)/layout.tsx` together arbitrate where every authenticated user lands.

| State | role | organizationId | Cold visit → server redirect | Mid-session → client guard |
|---|---|---|---|---|
| A | any | non-null | render dashboard | render dashboard |
| A/D | any | non-null, but URL is `/onboarding` or `/waiting` | n/a (those paths live in `(auth)`) | `router.replace('/')` |
| B | `owner` | null | `redirect('/onboarding')` | `router.replace('/onboarding')` |
| C | non-owner | null | `redirect('/waiting')` | `router.replace('/waiting')` |

### 10.1 Why two layers

- **Server-side redirect** in the dashboard layout runs before the first render — no flash of dashboard for users who don't belong there. Uses `getServerSessionUser()`, which reads the session cookie via `cookies()` from `next/headers`.
- **Client-side `OrgGuard`** runs on the dashboard tree's render and re-runs when `useAuthStore.user` changes. The mid-session case it solves: a viewer is sitting on `/waiting`, an owner attaches them in another tab, the next poll refetches `/api/auth/me` with the new `organization_id` claim, `useAuthStore` updates, the guard fires `router.replace('/')`.

### 10.2 The waiting-page polling loop

```
/waiting  ─ setInterval(30s) ──> invalidateBearerCache()
                              ──> qc.invalidateQueries(['auth','me'])
                                      │
                                      ▼
                              /api/auth/me  ── reads session cookie ── extracts claims
                                      │
                                      ▼
                              useSession useEffect → useAuthStore.setUser(...)
                                      │
                                      ▼
                              Re-render → if user.organizationId → router.replace('/')
```

`invalidateBearerCache()` is the non-obvious half: without it, the 55-second in-memory bearer cache in `api-client.ts` would re-serve the old JWT (with no `organization_id` claim) and the user would sit on `/waiting` for nearly a minute after assignment.

The poll cadence is 30 s by design — tighter polling would burn Keycloak token-refresh quota. The "Check now" button is the affordance for users who want an immediate answer.

### 10.3 `(auth)` deliberately doesn't wrap in `OrgGuard`

`/onboarding` and `/waiting` are the destinations the guard wants to send users to. Wrapping the `(auth)` route group in the guard creates a tight redirect loop: the guard sees "non-owner without org, not on /waiting → push to /waiting", but the push lands on `(auth)/waiting/...` which re-runs the guard. The split is intentional: `AuthGuard` still applies (the `(auth)` group requires authentication), but the org-routing is exclusively a `(dashboard)` concern.

