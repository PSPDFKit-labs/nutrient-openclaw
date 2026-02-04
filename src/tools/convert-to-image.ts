/**
 * Tool: nutrient_convert_to_image
 * Render PDF pages as PNG, JPEG, or WebP images via the DWS /build endpoint.
 */

import type { ToolDefinition, ToolResponse, FileReference } from '../types.js';
import { formatError } from '../errors.js';
import {
  readFileReference,
  writeResponseToFile,
  buildFormData,
  assertOutputDiffersFromInput,
  deriveOutputPath,
} from '../files.js';

export const convertToImageTool: ToolDefinition = {
  name: 'nutrient_convert_to_image',
  description:
    'Render PDF pages as PNG, JPEG, or WebP images. Supports custom DPI, width, height, and page ranges.',
  parameters: {
    type: 'object',
    required: ['filePath'],
    properties: {
      filePath: {
        type: 'string',
        description: 'Path to input PDF',
      },
      outputPath: {
        type: 'string',
        description: 'Path for output image. Auto-derived from input filename if omitted.',
      },
      format: {
        type: 'string',
        enum: ['png', 'jpeg', 'webp'],
        default: 'png',
        description: 'Image format (default: png)',
      },
      pages: {
        type: 'object',
        properties: {
          start: { type: 'integer', description: 'Start page (0-based)' },
          end: { type: 'integer', description: 'End page (0-based)' },
        },
      },
      width: { type: 'number', description: 'Output width in px' },
      height: { type: 'number', description: 'Output height in px' },
      dpi: { type: 'number', description: 'Output resolution (default: 150)' },
    },
  },

  async execute(args, ctx): Promise<ToolResponse> {
    try {
      const outputPath = args.outputPath || deriveOutputPath(args.filePath, args.format ?? 'png');
      assertOutputDiffersFromInput(args.filePath, outputPath, ctx.sandboxDir);

      const fileRef = readFileReference(args.filePath, ctx.sandboxDir);
      const fileRefs = new Map<string, FileReference>([[fileRef.key, fileRef]]);

      const part: Record<string, unknown> = {
        file: fileRef.url ?? fileRef.key,
      };
      if (args.pages) part.pages = args.pages;

      const output: Record<string, unknown> = {
        type: 'image',
        format: args.format ?? 'png',
      };
      if (args.dpi != null) output.dpi = args.dpi;
      if (args.width != null) output.width = args.width;
      if (args.height != null) output.height = args.height;

      const instructions = {
        parts: [part],
        output,
      };

      const body = buildFormData(instructions, fileRefs);
      const response = await ctx.client.post('build', body);

      const writtenPath = writeResponseToFile(
        response.data as ArrayBuffer,
        outputPath,
        ctx.sandboxDir,
      );

      ctx.credits.log({
        operation: 'convert_to_image',
        requestCost: response.creditsUsed ?? 0,
        remainingCredits: response.creditsRemaining,
      });

      return {
        success: true,
        output: `Image created at ${writtenPath}`,
        credits_used: response.creditsUsed ?? undefined,
      };
    } catch (e) {
      return formatError(e);
    }
  },
};
