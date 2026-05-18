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
