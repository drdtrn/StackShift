# Secrets

## Log Source Key Pepper

Log source API keys are HMAC-SHA-256 hashed with a deployment pepper. The API fails at startup if the pepper is missing or decodes to fewer than 32 bytes.

Generate a local pepper:

```bash
openssl rand -base64 32
```

Store it in user secrets for local development:

```bash
dotnet user-secrets set "LogSources:KeyPepperBase64" "<base64 pepper>" --project src/backend/StackSift.Api
```

Production should provide the same value through `LogSources__KeyPepperBase64`.
