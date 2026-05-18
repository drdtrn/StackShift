# AI-Assisted Swagger Enrichment — Session Log

> **Card:** BE-20
> **Date:** 2026-05-04
> **Author:** Dardan T.
> **Tools:** Claude Code (Opus 4.7) for the audit + bulk edits; Cursor (Sonnet 4.6) for spot fixes.
> **Outcome:** All 9 controllers + 4 request-body records render with full `<summary>`,
> `<param>`, `<returns>`, `<response>` doc comments. CS1591 unsuppressed in
> `StackSift.Api.csproj`. `dotnet build` clean. `swagger.json` generates 24 operations
> across 18 paths with zero summary/description gaps.

---

## 1. Prompts used

### Prompt 1 — full audit (Claude Code)

> Read every controller under `src/backend/StackSift.Api/Controllers/`. Produce a markdown
> table listing: file, action method name, current `<summary>` quality (Good / Thin /
> Missing), `<param>` coverage, `[ProducesResponseType]` coverage, gap notes. Audit only.

**Output:** the table that became §1.1 of the BE-20 plan.
**Quality:** ⭐⭐⭐⭐⭐ — accurate, no fabricated gaps.

### Prompt 2 — record-model docs (Claude Code)

> For each record under `src/backend/StackSift.Api/Models/Requests/`, add a class-level
> `<summary>` describing the endpoint it bodies, and a `<param>` per record parameter.
> Use semantics from the validators in `StackSift.Application/Commands/...` where
> available; do not invent ranges or limits.

**Output:** four record blocks (`UpdateProjectBody`, `UpdateAlertRuleBody`,
`UpdateIncidentStatusBody`, `CreateLogSourceBody`).
**Quality:** ⭐⭐⭐⭐ — three accepted as-is; `UpdateAlertRuleBody` needed verification of
the `AlertRuleCondition` enum values (Threshold / Anomaly / Pattern / Absence).

### Prompt 3 — `<response>` codes (Cursor inline)

> For this controller's actions, add a `<response code="...">description</response>` doc tag
> for every `[ProducesResponseType]` declared. Descriptions must reflect the actual handler
> behaviour — open the handler in `StackSift.Application/...` and read it before writing.

**Output:** ~25 response descriptions across 9 controllers.
**Quality:** ⭐⭐⭐ — reliable on 200/204; ~30% of 400/404 cases needed manual rewording
because Cursor defaulted to generic phrasing instead of the actual reason.

## 2. Failures and rework (honest reflection)

- **Swashbuckle multipart-form blocker:** the `[FromForm] IFormFile file, [FromForm] Guid
  projectId` signature on `FilesController.Upload` made `swagger.json` return 500 —
  Swashbuckle 7.x rejects multiple `[FromForm]` params when one is `IFormFile`. AI's first
  fix ("add `c.MapType<IFormFile>(...)`") handled the schema mapping but not the parameter
  discovery error. Real fix: collapse the two form params into a single `UploadLogFileForm`
  record (also matches `.cursorrules` §2). Lesson: AI's first fix for a Swashbuckle error
  is often the right *shape* but the wrong *layer*; verify with
  `curl /swagger/v1/swagger.json | jq` after each edit.
- **Hallucinated enum values:** Claude initially listed `AlertRuleCondition.Spike` /
  `Drop` — neither exists. Wasted ~10 min. Lesson: paste the enum file contents into the
  prompt explicitly.
- **Hidden CS1591 surface area:** removing `1591` from `NoWarn` surfaced 51 warnings, not
  the ~10 expected. The 7 explicit pass-through controller constructors, three middleware
  classes, `BaseApiController`, and `ApiErrorResponse` all contributed. Resolution: convert
  controllers to primary constructors (matches the new `.cursorrules` §2) and add minimal
  class-level summaries to the rest.

## 3. Time saved

Estimated manual effort: 4 h. Actual AI-assisted effort: ~1 h 15 m. **Net saved: ~2 h 45 m.**

## 4. Lessons

1. **Audit before editing.** A read-only audit prompt prevents the AI from "fixing" things
   that aren't broken.
2. **Make the AI read the source of truth.** Telling Cursor to open the handler before
   writing the `<response>` description halved the rework rate.
3. **Domain enums are a hallucination magnet.** Paste the enum definition explicitly.
4. **Removing `1591` from `NoWarn` is the highest-leverage edit of the card.** Tooling beats
   discipline as a permanent guardrail.
5. **`swagger.json` is the integration test for XML docs.** Build-clean is necessary but
   not sufficient.

## 5. Evidence (in lieu of screenshots)

Screenshots were skipped — JSON-level evidence is machine-checkable and won't drift:

```bash
curl -s http://localhost:5190/swagger/v1/swagger.json | jq '
  "summary_gaps=\([.paths|to_entries[]|.value|to_entries[]|select(.value.summary==null)]|length)
   param_gaps=\([.paths[]|.[]|.parameters//[]|.[]|select(.description==null or .description=="")]|length)
   operations=\([.paths[]|.[]]|length)"'
# → "summary_gaps=0 param_gaps=0 operations=24"
```

`/swagger` loads with HTTP 200 and 28 schemas including all 4 `*Body` records.

## 6. Follow-ups

- Remove `CS1573` from `NoWarn` next sprint, after `CancellationToken` plumbing parameters
  are filtered out (likely via a Swashbuckle parameter filter).
- Add a CI check (`dotnet build /warnaserror:CS1591`) so missing XML docs fail CI.
- Add a CI grep guard: `! grep -rn '#pragma warning disable CS1591' src/backend/`.
