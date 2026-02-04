# Clarifying Questions — @nutrient-sdk/nutrient-openclaw

## 1. Tool Granularity: Monolith vs Many Tools?

The MCP server exposes 3 coarse tools (`document_processor`, `document_signer`, `check_credits`). OpenClaw's `api.registerTool()` pattern could go either way:

- **Option A:** Mirror the MCP server — a few powerful, instruction-driven tools (fewer tool calls, more complex schemas).
- **Option B:** One tool per capability — `convert`, `ocr`, `watermark`, `merge`, `redact`, `sign`, `extract_text`, etc. (simpler per-call, but 12+ tools registered).

Which approach? Option B is friendlier for LLM tool selection, but Option A reuses MCP schemas directly. Is there a preferred OpenClaw convention?

**ANSWER:** Option B — one tool per capability. Looking at the Unbrowse plugin, they register individual tools (`unbrowse_capture`, `unbrowse_replay`, `unbrowse_generate_skill`). This is the OpenClaw convention. LLMs pick the right tool more reliably with clear, single-purpose names. Prefix all tools with `nutrient_` (e.g., `nutrient_convert`, `nutrient_ocr`, `nutrient_sign`).

---

## 2. File I/O: Sandbox-Only or Filesystem Access?

The config schema mentions an optional `sandboxDir`. The MCP server has a sandbox resolver that restricts file reads/writes.

- Should the OpenClaw plugin **require** a sandbox directory (safer, more portable)?
- Or should it allow direct filesystem access when no sandbox is configured (matching MCP server behavior)?
- Does OpenClaw provide its own file abstraction (e.g., a workspace directory) that we should integrate with instead?

**ANSWER:** Allow both — optional sandboxDir in config, direct filesystem when not configured. Match MCP server behavior. OpenClaw agents have their own workspace directory; let the config override it if needed.

---

## 3. MVP Scope: Which Capabilities Ship in v1?

The full DWS API surface is large. For the initial release, which of these are **must-have** vs **post-v1**?

| Capability | Priority? |
|---|---|
| PDF conversion (Office → PDF, Image → PDF) | |
| HTML to PDF | |
| OCR | |
| Watermarking (text + image) | |
| Merge / split documents | |
| Flatten annotations | |
| Optimize / compress PDF | |
| Redaction (pattern-based) | |
| AI-powered redaction | |
| Form filling (Instant JSON) | |
| Digital signing (CMS/CAdES) | |
| Text / KV / table extraction (json-content) | |
| Credit balance & usage tracking | |

Are any of these explicitly out of scope or lower priority?

**ANSWER:** v1 must-haves: PDF conversion, HTML to PDF, OCR, watermarking, merge, redaction (pattern), AI redaction, digital signing, text/KV/table extraction, credit balance check. Post-v1: flatten, optimize, form filling (Instant JSON), full credit usage tracking with SQLite. Ship the core document processing capabilities first.

---

## 4. Credit Tracking: SQLite or Simpler?

The MCP server uses SQLite (via `better-sqlite3`) for credit tracking storage. That's a native module, which conflicts with the "pure TypeScript, no native modules" constraint.

Options:
- **Drop credit tracking** from v1 (just expose the balance-check API call).
- **Replace SQLite with a JSON file** for local usage logging.
- **Use an in-memory store** that doesn't persist across sessions.

Which approach fits best? How important is historical usage tracking vs. just "check my balance"?

**ANSWER:** For v1, just expose a `nutrient_credits` tool that calls the DWS API headers to check balance. No SQLite, no historical tracking in v1. Keep it pure TypeScript. If we add tracking later, use a JSON file, not SQLite (avoids native module dependency).

---

## 5. Target User: Agent Developers or End Users?

Who installs this plugin?

- **Agent developers** building document-processing workflows into their OpenClaw agents (technical, comfortable with API keys and config).
- **End users** who want "process this PDF" as a natural-language capability in their OpenClaw assistant (need polished UX, clear error messages, maybe guided setup).

This affects: error message style, tool descriptions (terse vs. explanatory), whether we need an onboarding flow, and how much we abstract the DWS instruction schema.

**ANSWER:** Primary target is agent developers. They'll configure the API key and set up the plugin. But tool descriptions should be clear enough for LLMs to use correctly — that means good descriptions with examples. No onboarding wizard needed. Clear error when API key is missing.

---

## 6. Auth & Key Management: Env Var Only or Plugin Config?

The config schema accepts `NUTRIENT_API_KEY`. Questions:

- Is this set via OpenClaw's plugin config UI, environment variable, or both?
- Should the plugin support **multiple API keys** (e.g., per-workspace or per-user in a team)?
- Should the plugin validate the key on startup (call the balance API) and surface a clear error if invalid/missing?

**ANSWER:** API key via plugin config (openclaw.plugin.json configSchema) and/or NUTRIENT_API_KEY env var. Config takes priority. Single key only — no multi-key. Validate on first API call, not on startup (lazy validation). Surface clear error with link to dashboard.nutrient.io/sign_up.

---

## 7. Success Criteria: What Does "Done" Look Like for v1?

Concrete definition of success:

- `openclaw plugins install @nutrient-sdk/nutrient-openclaw` works out of the box?
- A user can say "convert this DOCX to PDF" and it just works?
- Published on npm with CI/CD?
- Documentation (README, tool descriptions) sufficient for self-service?
- Parity with the MCP server, or a curated subset?
- Any performance targets (e.g., max response time for a conversion)?

What's the bar for shipping v1 to npm?

**ANSWER:** v1 success criteria: (1) `openclaw plugins install @nutrient-sdk/nutrient-openclaw` works, (2) "convert this DOCX to PDF" works end-to-end, (3) all v1 tools functional with tests, (4) README with setup and usage, (5) published on npm under @nutrient-sdk scope. No CI/CD required for v1 — manual publish. No performance targets beyond DWS API response times.
