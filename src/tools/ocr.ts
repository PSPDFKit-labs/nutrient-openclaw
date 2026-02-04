/**
 * Tool: nutrient_ocr
 * Apply OCR to a scanned PDF or image, making text selectable/searchable.
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

export const ocrTool: ToolDefinition = {
  name: 'nutrient_ocr',
  description:
    'Apply OCR to a scanned PDF or image, producing a searchable PDF with selectable text.',
  parameters: {
    type: 'object',
    required: ['filePath', 'language'],
    properties: {
      filePath: {
        type: 'string',
        description: 'Path to input PDF or image',
      },
      outputPath: {
        type: 'string',
        description: 'Path for output PDF. Auto-derived from input filename with -ocr suffix if omitted.',
      },
      language: {
        type: 'string',
        description: "OCR language (e.g., 'english', 'german', 'french')",
      },
    },
  },

  async execute(args, ctx): Promise<ToolResponse> {
    try {
      const outputPath = args.outputPath || deriveOutputPath(args.filePath, 'pdf', '-ocr');
      assertOutputDiffersFromInput(args.filePath, outputPath, ctx.sandboxDir);

      const fileRef = readFileReference(args.filePath, ctx.sandboxDir);
      const fileRefs = new Map<string, FileReference>([[fileRef.key, fileRef]]);

      const instructions = {
        parts: [{ file: fileRef.url ?? fileRef.key }],
        actions: [{ type: 'ocr' as const, language: args.language }],
        output: { type: 'pdf' as const },
      };

      const body = buildFormData(instructions, fileRefs);
      const response = await ctx.client.post('build', body);

      const writtenPath = writeResponseToFile(
        response.data as ArrayBuffer,
        outputPath,
        ctx.sandboxDir,
      );

      ctx.credits.log({
        operation: 'ocr',
        requestCost: response.creditsUsed ?? 0,
        remainingCredits: response.creditsRemaining,
      });

      return {
        success: true,
        output: `OCR PDF created at ${writtenPath} (language: ${args.language})`,
        credits_used: response.creditsUsed ?? undefined,
      };
    } catch (e) {
      return formatError(e);
    }
  },
};
