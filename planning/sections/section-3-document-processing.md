# Section 3: Document Processing Tools

**Complexity:** L (Large)  
**Dependencies:** Section 1 (types/errors), Section 2 (client, files)  
**Estimated time:** 2–3 hours

## Objective

Implement 4 tool modules for document processing: `nutrient_convert_to_pdf`, `nutrient_convert_to_image`, `nutrient_convert_to_office`, and `nutrient_watermark`. Plus `nutrient_ocr` which also uses the `/build` endpoint.

## Context

### How the DWS `/build` endpoint works

All these tools call `POST https://api.nutrient.io/build` with:
- A `multipart/form-data` body containing an `instructions` JSON field and file attachments
- OR a `application/json` body when all inputs are URLs

The `instructions` JSON has this shape:
```json
{
  "parts": [{ "file": "<file_key_or_url>" }],
  "actions": [{ "type": "ocr", "language": "english" }],
  "output": { "type": "pdf" }
}
```

Files referenced in `parts[].file` or `actions[].image` are replaced with a FormData key, and the actual file is appended to FormData under that key.

### Tool pattern (every tool follows this)

Each tool module exports an object matching the `ToolDefinition` interface:
```typescript
export const myTool: ToolDefinition = {
  name: 'nutrient_xxx',
  description: '...',
  parameters: { /* JSON Schema */ },
  execute: async (args, ctx) => { /* returns ToolResponse */ },
};
```

The `execute` function:
1. Reads input file(s) using `readFileReference(filePath, ctx.sandboxDir)`
2. Builds instructions object
3. Builds FormData using `buildFormData(instructions, fileRefs)`
4. Calls `ctx.client.post('build', formData)`
5. Logs credits: `ctx.credits.log({ operation, requestCost, remainingCredits })`
6. Writes response to output file using `writeResponseToFile(response.data, outputPath, ctx.sandboxDir)`
7. Returns `{ success: true, output: "...", credits_used: N }`

Errors are caught and passed through `formatError(e)`.

### Imports needed in each tool file

```typescript
import type { ToolDefinition, ToolContext, ToolResponse } from '../types.js';
import { formatError, FileError } from '../errors.js';
import { readFileReference, writeResponseToFile, buildFormData, resolveWritePath } from '../files.js';
```

**Project root:** `/Users/nuthome/GdPicture-Java/nutrient-openclaw-plugin/`

## Files to Create

### 1. `src/tools/convert-to-pdf.ts`

Convert documents (DOCX, XLSX, PPTX, HTML, images) to PDF.

**DWS instructions:**
```json
{
  "parts": [{ "file": "<key>", "password": "...", "pages": { "start": 0, "end": -1 }, "layout": { "orientation": "portrait", "size": "A4" } }],
  "output": { "type": "pdf" }
}
```

**Parameters (JSON Schema):**
```json
{
  "type": "object",
  "required": ["filePath", "outputPath"],
  "properties": {
    "filePath": { "type": "string", "description": "Path to input file (DOCX, XLSX, PPTX, HTML, image, or PDF)" },
    "outputPath": { "type": "string", "description": "Path for output PDF" },
    "password": { "type": "string", "description": "Password for protected input file" },
    "pages": {
      "type": "object",
      "properties": {
        "start": { "type": "integer", "default": 0, "description": "Start page (0-based)" },
        "end": { "type": "integer", "default": -1, "description": "End page (0-based, -1 = last)" }
      }
    },
    "htmlLayout": {
      "type": "object",
      "description": "Layout options for HTML input",
      "properties": {
        "orientation": { "type": "string", "enum": ["portrait", "landscape"] },
        "size": { "oneOf": [
          { "type": "string", "enum": ["A0","A1","A2","A3","A4","A5","A6","A7","A8","Letter","Legal"] },
          { "type": "object", "properties": { "width": { "type": "number" }, "height": { "type": "number" } } }
        ]},
        "margin": {
          "type": "object",
          "properties": {
            "left": { "type": "number" }, "top": { "type": "number" },
            "right": { "type": "number" }, "bottom": { "type": "number" }
          }
        }
      }
    }
  }
}
```

**execute logic:**
1. `readFileReference(args.filePath, ctx.sandboxDir)` → get file ref
2. Build instructions: `{ parts: [{ file: ref.key, password?, pages?, layout? }], output: { type: 'pdf' } }`
3. `buildFormData(instructions, fileRefs)` → FormData
4. `ctx.client.post('build', formData)` → response
5. `writeResponseToFile(response.data, args.outputPath, ctx.sandboxDir)` → resolved path
6. Log credits, return success

### 2. `src/tools/convert-to-image.ts`

Render PDF pages as PNG/JPEG/WebP images.

**DWS instructions:**
```json
{
  "parts": [{ "file": "<key>" }],
  "output": { "type": "image", "format": "png", "dpi": 150 }
}
```

**Parameters:**
```json
{
  "type": "object",
  "required": ["filePath", "outputPath"],
  "properties": {
    "filePath": { "type": "string", "description": "Path to input PDF" },
    "outputPath": { "type": "string", "description": "Path for output image" },
    "format": { "type": "string", "enum": ["png", "jpeg", "webp"], "default": "png" },
    "pages": { "type": "object", "properties": { "start": { "type": "integer" }, "end": { "type": "integer" } } },
    "width": { "type": "number", "description": "Output width in px" },
    "height": { "type": "number", "description": "Output height in px" },
    "dpi": { "type": "number", "description": "Output resolution (default: 150)" }
  }
}
```

### 3. `src/tools/convert-to-office.ts`

Convert PDF to DOCX, XLSX, or PPTX.

**DWS instructions:**
```json
{
  "parts": [{ "file": "<key>" }],
  "output": { "type": "docx" }
}
```

**Parameters:**
```json
{
  "type": "object",
  "required": ["filePath", "outputPath", "format"],
  "properties": {
    "filePath": { "type": "string", "description": "Path to input PDF" },
    "outputPath": { "type": "string", "description": "Path for output Office file" },
    "format": { "type": "string", "enum": ["docx", "xlsx", "pptx"], "description": "Target format" }
  }
}
```

### 4. `src/tools/ocr.ts`

Apply OCR to a scanned PDF, making text selectable/searchable.

**DWS instructions:**
```json
{
  "parts": [{ "file": "<key>" }],
  "actions": [{ "type": "ocr", "language": "english" }],
  "output": { "type": "pdf" }
}
```

**Parameters:**
```json
{
  "type": "object",
  "required": ["filePath", "outputPath", "language"],
  "properties": {
    "filePath": { "type": "string", "description": "Path to input PDF or image" },
    "outputPath": { "type": "string", "description": "Path for output PDF" },
    "language": { "type": "string", "description": "OCR language (e.g., 'english', 'german', 'french')" }
  }
}
```

### 5. `src/tools/watermark.ts`

Add text or image watermarks to a PDF.

**DWS instructions (text watermark):**
```json
{
  "parts": [{ "file": "<key>" }],
  "actions": [{
    "type": "watermark",
    "watermarkType": "text",
    "text": "DRAFT",
    "width": "50%",
    "height": "50%",
    "opacity": 0.5,
    "rotation": 45
  }],
  "output": { "type": "pdf" }
}
```

**DWS instructions (image watermark):**
```json
{
  "parts": [{ "file": "<key>" }],
  "actions": [{
    "type": "watermark",
    "watermarkType": "image",
    "image": "<watermark_image_key>",
    "width": "30%",
    "height": "30%"
  }],
  "output": { "type": "pdf" }
}
```

Note: for image watermarks, the watermark image must also be added to FormData and its key referenced in `actions[].image`.

**Parameters:**
```json
{
  "type": "object",
  "required": ["filePath", "outputPath", "watermarkType", "width", "height"],
  "properties": {
    "filePath": { "type": "string" },
    "outputPath": { "type": "string" },
    "watermarkType": { "type": "string", "enum": ["text", "image"] },
    "text": { "type": "string", "description": "Watermark text (required if type=text)" },
    "imagePath": { "type": "string", "description": "Path to watermark image (required if type=image)" },
    "width": { "oneOf": [{ "type": "number" }, { "type": "string" }], "description": "Width in points or '50%'" },
    "height": { "oneOf": [{ "type": "number" }, { "type": "string" }], "description": "Height in points or '50%'" },
    "opacity": { "type": "number", "minimum": 0, "maximum": 1, "description": "0-1 (default: 0.7)" },
    "rotation": { "type": "number", "description": "Degrees counter-clockwise" },
    "fontColor": { "type": "string", "description": "Hex color for text (e.g., '#FF0000')" },
    "fontSize": { "type": "number", "description": "Font size in points" }
  }
}
```

## Acceptance Criteria

- [ ] Each tool file exports a `ToolDefinition` object with `name`, `description`, `parameters`, `execute`
- [ ] `nutrient_convert_to_pdf` handles: DOCX→PDF, HTML→PDF (with layout options), Image→PDF, PDF→PDF with page ranges
- [ ] `nutrient_convert_to_image` handles: PDF→PNG, PDF→JPEG, PDF→WebP with optional DPI/size
- [ ] `nutrient_convert_to_office` handles: PDF→DOCX, PDF→XLSX, PDF→PPTX
- [ ] `nutrient_ocr` sends OCR action with language parameter
- [ ] `nutrient_watermark` handles both text and image watermarks; image watermarks add the image file to FormData
- [ ] All tools log credits via `ctx.credits.log()`
- [ ] All tools wrap execute body in try/catch → `formatError(e)`
- [ ] All tools use `assertOutputDiffersFromInput()` to prevent overwriting input
- [ ] `npm run build` succeeds with all 5 new tool files

## Code to Port

| Source File | What to Port |
|---|---|
| `/tmp/nutrient-dws-mcp-server/src/dws/build.ts` | `processInstructions()` logic for replacing file paths with keys |
| `/tmp/nutrient-dws-mcp-server/src/dws/build.ts` | `processActionFileReferences()` for watermark image handling |
| `/tmp/nutrient-dws-mcp-server/src/schemas.ts` | `FilePartSchema` (page range, layout), `BaseWatermarkPropertiesSchema`, `OcrActionSchema` — convert Zod schemas to JSON Schema in tool parameters |
| `/tmp/nutrient-dws-mcp-server/src/schemas.ts` | `ImageOutputSchema`, `OfficeOutputSchema`, `PDFOutputSchema` — output type structures |

## Tests Required

Covered in Section 9. Key test cases per tool:
- Happy path: correct instructions built, API called with right endpoint, file written
- Missing required params: error returned
- File not found: FileError
- API error: NutrientApiError propagated through formatError
- Watermark: both text and image variants tested
