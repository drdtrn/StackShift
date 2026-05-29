# Uptime Kuma Bootstrap

Create these monitors in Uptime Kuma after deploying the stack.

| Name | Type | URL | Interval | Expected |
|------|------|-----|----------|----------|
| app | HTTP | `https://app.stacksift.com/api/health` | 60s | 200 |
| api ready | HTTP | `https://api.stacksift.com/health/ready` | 30s | 200 |
| api live | HTTP | `https://api.stacksift.com/health/live` | 30s | 200 |
| auth | HTTP | `https://auth.stacksift.com/realms/stacksift/.well-known/openid-configuration` | 60s | 200 |
| Stripe webhook | HTTP keyword | `https://api.stacksift.com/api/v1/billing/webhook` | 300s | 400 |
| www | HTTP | `https://www.stacksift.com/api/health` | 60s | 200 |

Create a public status page at `status.stacksift.com` in Uptime Kuma under Status Pages.
