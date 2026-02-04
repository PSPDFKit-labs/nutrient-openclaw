# Implementation Sections — @nutrient-sdk/nutrient-openclaw

## Dependency Graph

```
Section 1: Project Scaffolding
    ↓
Section 2: HTTP Client + File I/O
    ↓
Section 3: Document Processing Tools ──────────┐
Section 4: Extraction Tools ───────────────────┤
Section 5: Redaction Tools ────────────────────┤
Section 6: Signing Tool ──────────────────────┤
Section 7: Credit Balance Tool ────────────────┤
    ↓                                          │
Section 8: Plugin Entry Point ←────────────────┘
    ↓
Section 9: Tests
    ↓
Section 10: README and Documentation
```

## Section Manifest

| # | Name | File | Complexity | Depends On | Status |
|---|------|------|------------|------------|--------|
| 1 | Project Scaffolding | [section-1-scaffolding.md](section-1-scaffolding.md) | S | — | ⬜ |
| 2 | HTTP Client + File I/O | [section-2-http-client.md](section-2-http-client.md) | M | 1 | ⬜ |
| 3 | Document Processing Tools | [section-3-document-processing.md](section-3-document-processing.md) | L | 1, 2 | ⬜ |
| 4 | Extraction Tools | [section-4-extraction.md](section-4-extraction.md) | M | 1, 2 | ⬜ |
| 5 | Redaction Tools | [section-5-redaction.md](section-5-redaction.md) | M | 1, 2 | ⬜ |
| 6 | Signing Tool | [section-6-signing.md](section-6-signing.md) | M | 1, 2 | ⬜ |
| 7 | Credit Balance Tool | [section-7-credits.md](section-7-credits.md) | S | 1, 2 | ⬜ |
| 8 | Plugin Entry Point | [section-8-entry-point.md](section-8-entry-point.md) | S | 1–7 | ⬜ |
| 9 | Tests | [section-9-tests.md](section-9-tests.md) | M | 1–8 | ⬜ |
| 10 | README and Documentation | [section-10-readme.md](section-10-readme.md) | S | 1–8 | ⬜ |

## Parallelization

- **Phase 1:** Section 1 (scaffolding) — must go first
- **Phase 2:** Section 2 (HTTP client) — depends on types from Section 1
- **Phase 3:** Sections 3, 4, 5, 6, 7 — **all parallelizable** (each creates isolated tool files using shared client/types)
- **Phase 4:** Section 8 (entry point) — wires everything together
- **Phase 5:** Sections 9, 10 — parallelizable (tests + docs)

## Project Root

All paths relative to: `/Users/nuthome/GdPicture-Java/nutrient-openclaw-plugin/`

## MCP Server Source (reference code to port)

Located at: `/tmp/nutrient-dws-mcp-server/src/`

## Architecture Decisions

Per ARCHITECTURE.md, the plugin differs from the spec in these ways:
- **10 tools** (not 12): merge/flatten are actions within `convert_to_pdf`, extraction modes consolidated into one tool
- **Zero runtime deps**: native `fetch` + `FormData` (Node 18+), no axios, no form-data package
- **JSONL credit tracking** instead of SQLite (no native modules)
- **Tool shape**: each tool exports `{ name, description, parameters, execute(args, ctx) }`
- **Context object**: `{ client, credits, sandboxDir }` passed to every tool's `execute()`
