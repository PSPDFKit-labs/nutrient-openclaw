# Section 6: Signing Tool

**Complexity:** M (Medium)  
**Dependencies:** Section 1 (types/errors), Section 2 (client, files)  
**Estimated time:** 1 hour

## Objective

Implement the `nutrient_sign` tool for digitally signing PDF documents. This uses the `/sign` endpoint (not `/build`), with its own request format.

## Context

### How the `/sign` endpoint works

The sign endpoint uses a different FormData structure than `/build`:
- `file` field: the PDF to sign (multipart file)
- `data` field: JSON string with signature options
- `watermark` field (optional): watermark image for signature appearance
- `graphic` field (optional): graphic image for signature appearance

**This is NOT the same as the `/build` endpoint.** The `/sign` endpoint has its own fields.

### Signature types
- **CMS (PKCS#7):** Standard digital signatures (default)
- **CAdES:** Advanced electronic signatures with levels: `b-lt` (default), `b-t`, `b-b`

### Visible vs invisible signatures
- **Invisible:** Omit `position` — signature is embedded but not visible on any page
- **Visible:** Provide `position.pageIndex` and `position.rect` — signature appears on the specified page at the given coordinates

### Signature options (sent as `data` JSON field)

```json
{
  "signatureType": "cms",
  "flatten": false,
  "signatureMetadata": {
    "signerName": "John Doe",
    "signatureReason": "Approval",
    "signatureLocation": "New York"
  },
  "position": {
    "pageIndex": 0,
    "rect": [50, 50, 200, 80]
  },
  "appearance": {
    "mode": "signatureAndDescription",
    "showSigner": true,
    "showReason": true,
    "showSignDate": true
  },
  "cadesLevel": "b-lt"
}
```

**Project root:** `/Users/nuthome/GdPicture-Java/nutrient-openclaw-plugin/`

## Files to Create

### 1. `src/tools/sign.ts`

**Parameters (JSON Schema):**
```json
{
  "type": "object",
  "required": ["filePath", "outputPath"],
  "properties": {
    "filePath": {
      "type": "string",
      "description": "Path to PDF to sign"
    },
    "outputPath": {
      "type": "string",
      "description": "Path for signed output PDF"
    },
    "signatureType": {
      "type": "string",
      "enum": ["cms", "cades"],
      "default": "cms",
      "description": "Signature type (default: cms)"
    },
    "signerName": {
      "type": "string",
      "description": "Name of person or organization signing"
    },
    "reason": {
      "type": "string",
      "description": "Reason for signing"
    },
    "location": {
      "type": "string",
      "description": "Location of signing"
    },
    "flatten": {
      "type": "boolean",
      "default": false,
      "description": "Flatten document before signing"
    },
    "pageIndex": {
      "type": "integer",
      "minimum": 0,
      "description": "Page for visible signature (0-based). Omit for invisible signature."
    },
    "rect": {
      "type": "array",
      "items": { "type": "number" },
      "minItems": 4,
      "maxItems": 4,
      "description": "Bounding box [left, top, width, height] in PDF points for visible signature"
    },
    "cadesLevel": {
      "type": "string",
      "enum": ["b-lt", "b-t", "b-b"],
      "default": "b-lt",
      "description": "CAdES level (only for cades signatureType)"
    },
    "watermarkImagePath": {
      "type": "string",
      "description": "Path to watermark image for signature appearance"
    },
    "graphicImagePath": {
      "type": "string",
      "description": "Path to graphic image for signature appearance"
    }
  }
}
```

**execute logic:**

```typescript
async execute(args, ctx) {
  try {
    const {
      filePath, outputPath, signatureType = 'cms', signerName, reason, location,
      flatten = false, pageIndex, rect, cadesLevel = 'b-lt',
      watermarkImagePath, graphicImagePath,
    } = args;

    assertOutputDiffersFromInput(filePath, outputPath, ctx.sandboxDir);

    // Read the main PDF file
    const fileRef = readFileReference(filePath, ctx.sandboxDir);
    if (!fileRef.file) throw new FileError('Signing requires a local file, not a URL');

    // Build the signature options JSON (sent as `data` field)
    const signatureOptions: Record<string, unknown> = {
      signatureType,
      flatten,
    };

    // Signature metadata
    if (signerName || reason || location) {
      signatureOptions.signatureMetadata = {};
      if (signerName) (signatureOptions.signatureMetadata as any).signerName = signerName;
      if (reason) (signatureOptions.signatureMetadata as any).signatureReason = reason;
      if (location) (signatureOptions.signatureMetadata as any).signatureLocation = location;
    }

    // Visible signature position
    if (pageIndex != null && rect) {
      signatureOptions.position = { pageIndex, rect };
      // Default appearance for visible signatures
      signatureOptions.appearance = {
        mode: 'signatureAndDescription',
        showSigner: true,
        showSignDate: true,
      };
    }

    // CAdES level (only relevant for cades type)
    if (signatureType === 'cades') {
      signatureOptions.cadesLevel = cadesLevel;
    }

    // Build FormData with the /sign endpoint format
    const formData = new FormData();

    // Main file
    const blob = new Blob([fileRef.file.buffer]);
    formData.append('file', blob, fileRef.name);

    // Signature options
    formData.append('data', JSON.stringify(signatureOptions));

    // Optional watermark image
    if (watermarkImagePath) {
      const wmRef = readFileReference(watermarkImagePath, ctx.sandboxDir);
      if (!wmRef.file) throw new FileError('Watermark image must be a local file');
      const wmBlob = new Blob([wmRef.file.buffer]);
      formData.append('watermark', wmBlob, wmRef.name);
    }

    // Optional graphic image
    if (graphicImagePath) {
      const gfxRef = readFileReference(graphicImagePath, ctx.sandboxDir);
      if (!gfxRef.file) throw new FileError('Graphic image must be a local file');
      const gfxBlob = new Blob([gfxRef.file.buffer]);
      formData.append('graphic', gfxBlob, gfxRef.name);
    }

    // Call /sign endpoint (not /build)
    const response = await ctx.client.post('sign', formData);

    const resolvedOutput = writeResponseToFile(response.data as ArrayBuffer, outputPath, ctx.sandboxDir);

    if (response.creditsUsed != null) {
      ctx.credits.log({ operation: 'sign', requestCost: response.creditsUsed, remainingCredits: response.creditsRemaining });
    }

    return { success: true, output: `Signed: ${resolvedOutput}`, credits_used: response.creditsUsed ?? undefined };
  } catch (e) {
    return formatError(e);
  }
}
```

## Acceptance Criteria

- [ ] `src/tools/sign.ts` exports a `ToolDefinition` named `nutrient_sign`
- [ ] Calls `/sign` endpoint (not `/build`)
- [ ] FormData has `file` (PDF blob), `data` (JSON string with signature options)
- [ ] Optional `watermark` and `graphic` fields added to FormData when paths provided
- [ ] Invisible signature: no `position` or `appearance` in options when `pageIndex`/`rect` omitted
- [ ] Visible signature: includes `position` and `appearance` when `pageIndex` and `rect` provided
- [ ] CAdES level only included when `signatureType === 'cades'`
- [ ] Signature metadata (`signerName`, `reason`, `location`) mapped to API field names (`signerName`, `signatureReason`, `signatureLocation`)
- [ ] Uses `assertOutputDiffersFromInput()`
- [ ] URL inputs rejected (requires local file)
- [ ] Credits logged, errors formatted
- [ ] `npm run build` succeeds

## Code to Port

| Source File | What to Port |
|---|---|
| `/tmp/nutrient-dws-mcp-server/src/dws/sign.ts` | `performSignCall()` — the entire function. Adapt: replace MCP sandbox with `readFileReference`, replace stream with ArrayBuffer, use native `FormData`/`Blob` instead of `form-data` package. |
| `/tmp/nutrient-dws-mcp-server/src/dws/sign.ts` | `addFileToFormData()` — helper for adding optional files. Simplified inline in our version. |
| `/tmp/nutrient-dws-mcp-server/src/schemas.ts` | `CreateDigitalSignatureSchema`, `SignatureMetadataSchema`, `SignaturePositionSchema`, `SignatureAppearanceSchema` — convert Zod to JSON Schema. |

## Tests Required

Covered in Section 9. Key test cases:
- Basic CMS signature: correct FormData fields (`file`, `data`)
- CAdES signature: `cadesLevel` included in options
- Visible signature: `position` and `appearance` in options
- Invisible signature: no `position` in options
- Signature metadata: `signerName`, `signatureReason`, `signatureLocation` in nested object
- Watermark image: `watermark` field added to FormData
- Graphic image: `graphic` field added to FormData
- API called with `/sign` endpoint
- URL inputs rejected
