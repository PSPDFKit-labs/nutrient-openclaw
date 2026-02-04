/**
 * Tool: nutrient_watermark
 * Add text or image watermarks to a PDF via the DWS /build endpoint.
 */

import type { ToolDefinition, ToolResponse, FileReference } from '../types.js';
import { formatError } from '../errors.js';
import {
  readFileReference,
  writeResponseToFile,
  buildFormData,
  assertOutputDiffersFromInput,
} from '../files.js';

export const watermarkTool: ToolDefinition = {
  name: 'nutrient_watermark',
  description:
    'Add a text or image watermark to a PDF. Supports opacity, rotation, font color, font size, and positioning.',
  parameters: {
    type: 'object',
    required: ['filePath', 'outputPath', 'watermarkType', 'width', 'height'],
    properties: {
      filePath: { type: 'string', description: 'Path to input PDF' },
      outputPath: { type: 'string', description: 'Path for output PDF' },
      watermarkType: {
        type: 'string',
        enum: ['text', 'image'],
        description: 'Type of watermark',
      },
      text: {
        type: 'string',
        description: 'Watermark text (required if watermarkType is text)',
      },
      imagePath: {
        type: 'string',
        description: 'Path to watermark image (required if watermarkType is image)',
      },
      width: {
        oneOf: [{ type: 'number' }, { type: 'string' }],
        description: "Width in points or percentage (e.g., '50%')",
      },
      height: {
        oneOf: [{ type: 'number' }, { type: 'string' }],
        description: "Height in points or percentage (e.g., '50%')",
      },
      opacity: {
        type: 'number',
        minimum: 0,
        maximum: 1,
        description: 'Opacity 0-1 (default: 0.7)',
      },
      rotation: {
        type: 'number',
        description: 'Degrees counter-clockwise',
      },
      fontColor: {
        type: 'string',
        description: "Hex color for text (e.g., '#FF0000')",
      },
      fontSize: {
        type: 'number',
        description: 'Font size in points',
      },
    },
  },

  async execute(args, ctx): Promise<ToolResponse> {
    try {
      assertOutputDiffersFromInput(args.filePath, args.outputPath, ctx.sandboxDir);

      const fileRef = readFileReference(args.filePath, ctx.sandboxDir);
      const fileRefs = new Map<string, FileReference>([[fileRef.key, fileRef]]);

      // Build the watermark action
      const action: Record<string, unknown> = {
        type: 'watermark',
        watermarkType: args.watermarkType,
        width: args.width,
        height: args.height,
      };

      if (args.opacity != null) action.opacity = args.opacity;
      if (args.rotation != null) action.rotation = args.rotation;

      if (args.watermarkType === 'text') {
        action.text = args.text;
        if (args.fontColor) action.fontColor = args.fontColor;
        if (args.fontSize != null) action.fontSize = args.fontSize;
      } else if (args.watermarkType === 'image') {
        // Image watermarks: read the image file and add to FormData
        const imageRef = readFileReference(args.imagePath, ctx.sandboxDir);
        fileRefs.set(imageRef.key, imageRef);
        action.image = imageRef.url ?? imageRef.key;
      }

      const instructions = {
        parts: [{ file: fileRef.url ?? fileRef.key }],
        actions: [action],
        output: { type: 'pdf' as const },
      };

      const body = buildFormData(instructions, fileRefs);
      const response = await ctx.client.post('build', body);

      const outputPath = writeResponseToFile(
        response.data as ArrayBuffer,
        args.outputPath,
        ctx.sandboxDir,
      );

      ctx.credits.log({
        operation: 'watermark',
        requestCost: response.creditsUsed ?? 0,
        remainingCredits: response.creditsRemaining,
      });

      return {
        success: true,
        output: `Watermarked PDF created at ${outputPath}`,
        credits_used: response.creditsUsed ?? undefined,
      };
    } catch (e) {
      return formatError(e);
    }
  },
};
