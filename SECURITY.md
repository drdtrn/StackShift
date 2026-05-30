# Security Policy

## Reporting a vulnerability

Email **security@stacksift.com** with the details. Please do not open a public
GitHub issue for security reports.

If you want to encrypt your report, request our PGP key at the same address.

What to include:

- A description of the issue and its impact.
- Steps to reproduce (a proof of concept if possible).
- The affected component (dashboard, API, marketing site, ingest endpoint, or
  Keycloak realm configuration).

## Scope

In scope:

- `app.stacksift.com` (dashboard) and its BFF routes
- `api.stacksift.com` (`/api/v1/*`)
- The ingest endpoint and API-key authentication
- The Keycloak realm **configuration** (not Keycloak itself)
- Multi-tenant isolation (cross-organization access)

Out of scope:

- Denial-of-service / volumetric attacks
- Findings that require a compromised host or physical access
- Third-party services we depend on (Stripe, Cloudflare, OpenAI, the cluster
  control plane)
- Our marketing copy / SEO
- Automated scanner output without a demonstrated impact

## Response

We aim to acknowledge reports within 3 business days and to agree on a
remediation timeline based on severity. We will credit reporters who wish to be
named once a fix has shipped.

## Safe harbor

We will not pursue legal action for good-faith security research that respects
this policy, stays within scope, avoids privacy violations and service
degradation, and gives us reasonable time to remediate before disclosure.

## Disclosure process for v1

This is a self-hosted disclosure program (no managed bug-bounty platform yet).
A managed program will be evaluated once MRR exceeds the threshold noted in the
PRE-DEPLOY security plan (§16.2). Test accounts for researchers are provisioned
on request.
