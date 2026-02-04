/**
 * Tool: nutrient_sign
 * Digitally sign PDF documents via the DWS /sign endpoint.
 *
 * Supports CMS (PKCS#7) and CAdES signature types, visible and invisible
 * signatures, and optional watermark/graphic images for signature appearance.
 */

import type { ToolDefinition, ToolResponse } from '../types.js';
import { FileError, formatError } from '../errors.js';
import {
  readFileReference,
  writeResponseToFile,
  assertOutputDiffersFromInput,
} from '../files.js';

/** Build the signature options JSON sent as the `data` FormData field. */
function buildSignatureOptions(args: {
  signatureType: string;
  flatten: boolean;
  signerName?: string;
  reason?: string;
  location?: string;
  pageIndex?: number;
  rect?: number[];
  cadesLevel?: string;
}): Record<string, unknown> {
  const opts: Record<string, unknown> = {
    signatureType: args.signatureType,
    flatten: args.flatten,
  };

  // Metadata — only include when at least one field is provided
  const hasMeta = args.signerName || args.reason || args.location;
  if (hasMeta) {
    opts.signatureMetadata = {
      ...(args.signerName && { signerName: args.signerName }),
      ...(args.reason && { signatureReason: args.reason }),
      ...(args.location && { signatureLocation: args.location }),
    };
  }

  // Visible signature: position + default appearance
  if (args.pageIndex != null && args.rect) {
    opts.position = { pageIndex: args.pageIndex, rect: args.rect };
    opts.appearance = {
      mode: 'signatureAndDescription',
      showSigner: true,
      showSignDate: true,
    };
  }

  // CAdES level only applies to cades signatures
  if (args.signatureType === 'cades') {
    opts.cadesLevel = args.cadesLevel ?? 'b-lt';
  }

  return opts;
}

export const signTool: ToolDefinition = {
  name: 'nutrient_sign',
  description:
    'Digitally sign a PDF document. Supports CMS and CAdES signature types, ' +
    'visible or invisible signatures, and optional watermark/graphic images.',
  parameters: {
    type: 'object',
    required: ['filePath', 'outputPath'],
    properties: {
      filePath: {
        type: 'string',
        description: 'Path to the PDF to sign',
      },
      outputPath: {
        type: 'string',
        description: 'Path for the signed output PDF',
      },
      signatureType: {
        type: 'string',
        enum: ['cms', 'cades'],
        default: 'cms',
        description: 'Signature type (default: cms)',
      },
      signerName: {
        type: 'string',
        description: 'Name of the person or organization signing',
      },
      reason: {
        type: 'string',
        description: 'Reason for signing',
      },
      location: {
        type: 'string',
        description: 'Location of signing',
      },
      flatten: {
        type: 'boolean',
        default: false,
        description: 'Flatten the document before signing',
      },
      pageIndex: {
        type: 'integer',
        minimum: 0,
        description: 'Page for visible signature (0-based). Omit for invisible signature.',
      },
      rect: {
        type: 'array',
        items: { type: 'number' },
        minItems: 4,
        maxItems: 4,
        description: 'Bounding box [left, top, width, height] in PDF points for visible signature',
      },
      cadesLevel: {
        type: 'string',
        enum: ['b-lt', 'b-t', 'b-b'],
        default: 'b-lt',
        description: 'CAdES level (only for cades signatureType)',
      },
      watermarkImagePath: {
        type: 'string',
        description: 'Path to a watermark image for the signature appearance',
      },
      graphicImagePath: {
        type: 'string',
        description: 'Path to a graphic image for the signature appearance',
      },
    },
  },

  async execute(args, ctx): Promise<ToolResponse> {
    try {
      const {
        filePath,
        outputPath,
        signatureType = 'cms',
        signerName,
        reason,
        location,
        flatten = false,
        pageIndex,
        rect,
        cadesLevel = 'b-lt',
        watermarkImagePath,
        graphicImagePath,
      } = args;

      assertOutputDiffersFromInput(filePath, outputPath, ctx.sandboxDir);

      // Read the PDF — signing requires a local file, not a URL
      const fileRef = readFileReference(filePath, ctx.sandboxDir);
      if (!fileRef.file) {
        throw new FileError('Signing requires a local file, not a URL');
      }

      const signatureOptions = buildSignatureOptions({
        signatureType,
        flatten,
        signerName,
        reason,
        location,
        pageIndex,
        rect,
        cadesLevel,
      });

      // Assemble FormData for the /sign endpoint
      const formData = new FormData();
      formData.append('file', new Blob([new Uint8Array(fileRef.file.buffer)]), fileRef.name);
      formData.append('data', JSON.stringify(signatureOptions));

      // Optional image attachments
      if (watermarkImagePath) {
        const wmRef = readFileReference(watermarkImagePath, ctx.sandboxDir);
        if (!wmRef.file) throw new FileError('Watermark image must be a local file');
        formData.append('watermark', new Blob([new Uint8Array(wmRef.file.buffer)]), wmRef.name);
      }

      if (graphicImagePath) {
        const gfxRef = readFileReference(graphicImagePath, ctx.sandboxDir);
        if (!gfxRef.file) throw new FileError('Graphic image must be a local file');
        formData.append('graphic', new Blob([new Uint8Array(gfxRef.file.buffer)]), gfxRef.name);
      }

      // POST to /sign (not /build)
      const response = await ctx.client.post('sign', formData);

      const resolvedOutput = writeResponseToFile(
        response.data as ArrayBuffer,
        outputPath,
        ctx.sandboxDir,
      );

      ctx.credits.log({
        operation: 'sign',
        requestCost: response.creditsUsed ?? 0,
        remainingCredits: response.creditsRemaining,
      });

      return {
        success: true,
        output: `Signed PDF saved to ${resolvedOutput}`,
        credits_used: response.creditsUsed ?? undefined,
      };
    } catch (e) {
      return formatError(e);
    }
  },
};
