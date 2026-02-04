# @nutrient-sdk/nutrient-openclaw

[![npm](https://img.shields.io/npm/v/@nutrient-sdk/nutrient-openclaw)](https://www.npmjs.com/package/@nutrient-sdk/nutrient-openclaw)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

OpenClaw plugin for document processing via the [Nutrient DWS API](https://www.nutrient.io/guides/web/document-engine/api/). Convert, OCR, redact, sign, watermark, and extract data from documents — all from your AI agent.

## Installation

```bash
openclaw plugins install @nutrient-sdk/nutrient-openclaw
```

## Configuration

You need a Nutrient DWS API key. [Sign up for free](https://dashboard.nutrient.io/sign_up).

**Option 1 — Plugin config** (recommended):

Set the API key in your OpenClaw plugin settings. The plugin will prompt for it on first use.

**Option 2 — Environment variable:**

```bash
export NUTRIENT_API_KEY=pdf_live_your_key_here
```

The plugin checks config first, then falls back to the environment variable.

### Optional: Sandbox mode

Set `sandboxDir` to restrict all file operations to a specific directory:

```json
{
  "sandboxDir": "~/documents"
}
```

When set, all file paths are resolved relative to this directory. Attempts to read or write outside the sandbox are rejected.

## Quick Start

Once installed, your agent can process documents directly:

> **You:** Convert this DOCX to PDF: ~/reports/quarterly.docx
>
> **Agent:** *(calls `nutrient_convert_to_pdf`)* → Converted to ~/reports/quarterly.pdf (2 credits used)

> **You:** Extract the tables from invoice.pdf
>
> **Agent:** *(calls `nutrient_extract_text` with mode "tables")* → Found 3 tables with 47 rows

## Tools

### `nutrient_convert_to_pdf`

Convert documents (DOCX, XLSX, PPTX, HTML, images) to PDF.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `input` | string | ✅ | Source file path or URL |
| `output` | string | ✅ | Output PDF path |
| `pageRanges` | string | | Page range (e.g. `"1-5,8"`) |
| `password` | string | | Password for encrypted files |
| `htmlWidth` | number | | HTML viewport width in px |
| `htmlHeight` | number | | HTML viewport height in px |

```json
{ "input": "report.docx", "output": "report.pdf" }
```

### `nutrient_convert_to_image`

Render PDF pages as PNG, JPEG, or WebP images.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `input` | string | ✅ | Source PDF path or URL |
| `output` | string | ✅ | Output image path |
| `format` | string | | `"png"`, `"jpeg"`, or `"webp"` (default: `"png"`) |
| `dpi` | number | | Resolution in DPI |
| `width` | number | | Output width in px |
| `height` | number | | Output height in px |
| `pageRanges` | string | | Pages to render |

```json
{ "input": "doc.pdf", "output": "page1.png", "dpi": 300 }
```

### `nutrient_convert_to_office`

Convert PDF to DOCX, XLSX, or PPTX.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `input` | string | ✅ | Source PDF path or URL |
| `output` | string | ✅ | Output file path |
| `format` | string | ✅ | `"docx"`, `"xlsx"`, or `"pptx"` |

```json
{ "input": "doc.pdf", "output": "doc.docx", "format": "docx" }
```

### `nutrient_extract_text`

Extract text, tables, or key-value pairs from documents.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `input` | string | ✅ | Source file path or URL |
| `mode` | string | | `"text"`, `"tables"`, or `"key-values"` (default: `"text"`) |
| `language` | string/array | | OCR language(s) (default: `"english"`) |

```json
{ "input": "invoice.pdf", "mode": "tables" }
```

### `nutrient_ocr`

Apply OCR to scanned documents, producing a searchable PDF.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `input` | string | ✅ | Source PDF path or URL |
| `output` | string | ✅ | Output PDF path |
| `language` | string/array | | OCR language(s) (default: `"english"`) |

```json
{ "input": "scan.pdf", "output": "searchable.pdf", "language": "german" }
```

### `nutrient_watermark`

Add text or image watermarks to PDFs.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `input` | string | ✅ | Source PDF path or URL |
| `output` | string | ✅ | Output PDF path |
| `text` | string | | Watermark text (use `text` or `image`, not both) |
| `image` | string | | Watermark image file path |
| `opacity` | number | | 0.0–1.0 (default: 0.5) |
| `rotation` | number | | Rotation angle in degrees |
| `fontSize` | number | | Font size for text watermarks |
| `fontColor` | string | | Font color (hex, e.g. `"#FF0000"`) |

```json
{ "input": "doc.pdf", "output": "watermarked.pdf", "text": "CONFIDENTIAL", "opacity": 0.3, "rotation": -45 }
```

### `nutrient_redact`

Pattern-based redaction using built-in presets, regex, or text search.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `input` | string | ✅ | Source PDF path or URL |
| `output` | string | ✅ | Output PDF path |
| `strategy` | string | ✅ | `"preset"`, `"regex"`, or `"text"` |
| `preset` | string | | Preset name (e.g. `"social-security-number"`, `"email-address"`) |
| `regex` | string | | Regular expression pattern |
| `text` | string | | Text to search and redact |
| `caseSensitive` | boolean | | Case sensitivity (default: true for regex, false for text) |
| `startPage` | number | | First page to scan |
| `pageLimit` | number | | Number of pages to scan |

```json
{ "input": "doc.pdf", "output": "redacted.pdf", "strategy": "preset", "preset": "social-security-number" }
```

### `nutrient_ai_redact`

AI-powered redaction that understands document context. Uses the Nutrient AI analysis endpoint.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `input` | string | ✅ | Source PDF **file path** (URLs not supported) |
| `output` | string | ✅ | Output PDF path |
| `criteria` | string | | What to redact (natural language, default: "all PII") |

```json
{ "input": "contract.pdf", "output": "redacted.pdf", "criteria": "names and addresses" }
```

> **Note:** AI redaction uploads the document for analysis. Has a 5-minute timeout. Does not support URL inputs.

### `nutrient_sign`

Apply digital signatures (CMS or CAdES) to PDFs.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `input` | string | ✅ | Source PDF **file path** (URLs not supported) |
| `output` | string | ✅ | Output PDF path |
| `signatureType` | string | | `"cms"` or `"cades"` (default: `"cms"`) |
| `cadesLevel` | string | | CAdES level: `"b-b"`, `"b-t"`, `"b-lt"` |
| `signerName` | string | | Signer's name |
| `reason` | string | | Reason for signing |
| `location` | string | | Signing location |
| `pageIndex` | number | | Page for visible signature |
| `rect` | number[] | | Visible signature rect `[left, top, width, height]` |

```json
{ "input": "contract.pdf", "output": "signed.pdf", "signerName": "Jane Doe", "reason": "Approval" }
```

### `nutrient_check_credits`

Check your Nutrient API credit balance and usage.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `action` | string | ✅ | `"balance"` or `"usage"` |
| `period` | string | | For usage: `"day"`, `"week"`, `"month"`, or `"all"` (default: `"week"`) |

```json
{ "action": "balance" }
```

## Error Handling

| Error | Cause | Fix |
|-------|-------|-----|
| `NUTRIENT_API_KEY not configured` | No API key set | Set in plugin config or env var |
| `File not found` | Input file doesn't exist | Check the file path |
| `Path outside sandbox` | File path escapes sandboxDir | Use paths within the configured sandbox |
| `API error (402)` | Insufficient credits | Top up at dashboard.nutrient.io |
| `API error (401)` | Invalid API key | Verify your key at dashboard.nutrient.io |

## Credit Tracking

Every API call logs credit usage to a local `.nutrient-credits.jsonl` file. Use `nutrient_check_credits` to view your balance and per-operation usage breakdown.

## Links

- [Nutrient DWS API Docs](https://www.nutrient.io/guides/web/document-engine/api/)
- [Get an API Key](https://dashboard.nutrient.io/sign_up)
- [OpenClaw Docs](https://docs.openclaw.ai)
- [npm Package](https://www.npmjs.com/package/@nutrient-sdk/nutrient-openclaw)

## License

MIT © [Nutrient GmbH](https://www.nutrient.io)
