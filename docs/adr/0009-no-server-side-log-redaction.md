# ADR 0009 — StackSift does not redact log content server-side

**Status:** Accepted
**Date:** 2026-05-29
**Context:** Plan 09 §9.11 (PII inventory and data classification).

## Decision

StackSift does **not** redact PII patterns from log content on the ingest
path. If a customer logs `user.email=alice@example.com`, we store it
verbatim — the customer is responsible for redacting their own end-user
PII before the log line leaves their application.

## Context

GDPR Article 28 names two roles:
- **Controller** — the entity that decides what personal data to collect
  and for what purpose. Always the StackSift customer for their
  application's end-users.
- **Processor** — the entity that processes that data on the controller's
  behalf. That is StackSift's role with respect to log content.

If StackSift redacts customer logs:

1. We become a partial controller of the data we redacted (we made a
   purpose-shaping decision: "this PII pattern is not useful").
2. Our redaction must be reliable — but PII pattern matching is heuristic.
   A false negative (PII not redacted that should have been) is a breach
   we caused; a false positive (information redacted that the customer
   needed) breaks their debugging.
3. We have to publish the regex set we use, so customers can know what
   we will and will not store. Any change to the set is a breaking
   change for every customer.

We accept none of those costs in exchange for a feature most customers
do not need (they already redact in their application code), and many
customers do not want (security teams want raw IPs and email patterns
visible for incident triage).

## Customer-side mitigation

The Serilog sink ships a `PiiRedactionEnricher` sample at
`src/backend/StackSift.Serilog.Sink/Samples/PiiRedactionEnricher.cs` (Plan
03 §3.G). It is **opt-in**, lives in the customer's process, and runs
before the log line leaves their application. We document the usage
pattern in the sink's README but do not enable it by default.

## Consequences

- **Privacy policy** (Plan 11 §3): explicit statement that log content is
  customer-controlled.
- **DPA** (Plan 11 §5): the data processing addendum specifies StackSift
  is a processor for log content, with the customer named as controller.
- **Security questionnaires**: when asked "do you redact PII," the answer
  is "no, by design — the customer is the controller." Link this ADR.
- **Marketing FAQ rewrite** (Plan 11 §1): the existing "we handle PII for
  you" copy is removed.

## Revisit when

- We add a server-side rules engine that customers configure (which would
  make the redaction customer-controlled, not StackSift-controlled, and
  is a different decision).
- A statutory change in any major jurisdiction makes processor-side
  redaction mandatory.
