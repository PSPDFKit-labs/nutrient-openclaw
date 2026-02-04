/**
 * Tool: nutrient_convert_to_office
 * Convert PDF to DOCX, XLSX, or PPTX via the DWS /build endpoint.
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

export const convertToOfficeTool: ToolDefinition = {
  name: 'nutrient_convert_to_office',
  description:
    'Convert a PDF to an Office format (DOCX, XLSX, or PPTX).',
  parameters: {
    type: 'object',
    required: ['filePath', 'format'],
    properties: {
      filePath: {
        type: 'string',
        description: 'Path to input PDF',
      },
      outputPath: {
        type: 'string',
        description: 'Path for output Office file. Auto-derived from input filename if omitted.',
      },
      format: {
        type: 'string',
        enum: ['docx', 'xlsx', 'pptx'],
        description: 'Target format',
      },
    },
  },

  async execute(args, ctx): Promise<ToolResponse> {
    try {
      const outputPath = args.outputPath || deriveOutputPath(args.filePath, args.format);
      assertOutputDiffersFromInput(args.filePath, outputPath, ctx.sandboxDir);

      const fileRef = readFileReference(args.filePath, ctx.sandboxDir);
      const fileRefs = new Map<string, FileReference>([[fileRef.key, fileRef]]);

      const instructions = {
        parts: [{ file: fileRef.url ?? fileRef.key }],
        output: { type: args.format },
      };

      const body = buildFormData(instructions, fileRefs);
      const response = await ctx.client.post('build', body);

      const writtenPath = writeResponseToFile(
        response.data as ArrayBuffer,
        outputPath,
        ctx.sandboxDir,
      );

      ctx.credits.log({
        operation: 'convert_to_office',
        requestCost: response.creditsUsed ?? 0,
        remainingCredits: response.creditsRemaining,
      });

      return {
        success: true,
        output: `${args.format.toUpperCase()} created at ${writtenPath}`,
        credits_used: response.creditsUsed ?? undefined,
      };
    } catch (e) {
      return formatError(e);
    }
  },
};
