# Section 10: README and Documentation

**Complexity:** S (Small)  
**Dependencies:** Sections 1–8 (need final tool list and parameter schemas)  
**Estimated time:** 45 minutes

## Objective

Write a comprehensive `README.md` that serves as the primary documentation for the plugin. Also create a `LICENSE` file.

## Context

The README must serve two audiences:
1. **Agent developers** — need install command, config, and quick start
2. **LLMs** — the tool descriptions in the code are what LLMs see, but the README helps developers understand what to expect

### README structure (from spec Section 12.4)

1. One-line install command
2. Configuration (API key setup)
3. Quick start example
4. Tool reference (all 10 tools with parameters)
5. Link to Nutrient DWS API docs

**Project root:** `/Users/nuthome/GdPicture-Java/nutrient-openclaw-plugin/`

## Files to Create/Modify

### 1. `README.md`

The README should include:

**Header section:**
- Package name: `@nutrient-sdk/nutrient-openclaw`
- One-line description
- Badges (npm version, license)

**Installation:**
```bash
openclaw plugins install @nutrient-sdk/nutrient-openclaw
```

**Configuration:**
- API key: how to get one (link to `https://dashboard.nutrient.io/sign_up`)
- Setting via plugin config vs environment variable
- Optional `sandboxDir` config

**Quick Start:**
- Example agent conversation showing a document conversion
- Show the tool invocation and expected result

**Tool Reference:**
For each of the 10 tools, include:
- Name
- Description (one sentence)
- Parameters table (name, type, required, description)
- Example invocation JSON

The 10 tools:
1. `nutrient_convert_to_pdf` — Convert documents to PDF
2. `nutrient_convert_to_image` — Render PDF pages as images
3. `nutrient_convert_to_office` — Convert PDF to Office formats
4. `nutrient_extract_text` — Extract text, tables, or key-value pairs
5. `nutrient_ocr` — Apply OCR to scanned documents
6. `nutrient_watermark` — Add watermarks to PDFs
7. `nutrient_redact` — Pattern-based redaction
8. `nutrient_ai_redact` — AI-powered redaction
9. `nutrient_sign` — Digital signatures
10. `nutrient_check_credits` — Check API credit balance

**Sandbox Mode:**
- What it does (restricts file access)
- How to enable (set `sandboxDir` in config)
- Path resolution behavior

**Error Handling:**
- Common errors and what they mean
- API key errors, file not found, sandbox escape

**Links:**
- Nutrient DWS API docs: `https://www.nutrient.io/guides/web/document-engine/api/`
- OpenClaw: link to OpenClaw docs
- npm package page

### 2. `LICENSE`

MIT license:

```
MIT License

Copyright (c) 2026 Nutrient GmbH

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Acceptance Criteria

- [ ] `README.md` includes installation command
- [ ] `README.md` includes API key configuration instructions with signup link
- [ ] `README.md` includes quick start example
- [ ] `README.md` includes all 10 tools with parameter tables
- [ ] `README.md` includes example JSON invocations for at least 3 tools
- [ ] `README.md` includes sandbox mode documentation
- [ ] `README.md` includes links to Nutrient DWS API docs
- [ ] `LICENSE` file exists with MIT license text
- [ ] No broken links in README
- [ ] README renders correctly as Markdown (no formatting issues)

## Code to Port

No code to port. Documentation is written fresh.

Reference:
- Tool names and parameters from Sections 3–7
- Configuration from `openclaw.plugin.json` (Section 1)
- The MCP server's README (if available) for API documentation patterns

## Tests Required

No tests for documentation. Visual review only.
