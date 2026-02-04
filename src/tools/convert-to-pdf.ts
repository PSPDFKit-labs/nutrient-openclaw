/**
 * Tool: nutrient_convert_to_pdf
 * Convert documents (DOCX, XLSX, PPTX, HTML, images) to PDF via the DWS /build endpoint.
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

export const convertToPdfTool: ToolDefinition = {
  name: 'nutrient_convert_to_pdf',
  description:
    'Convert a document (DOCX, XLSX, PPTX, HTML, image, or PDF) to PDF. ' +
    'Supports page ranges, password-protected files, and HTML layout options.',
  parameters: {
    type: 'object',
    required: ['filePath'],
    properties: {
      filePath: {
        type: 'string',
        description: 'Path to input file (DOCX, XLSX, PPTX, HTML, image, or PDF)',
      },
      outputPath: {
        type: 'string',
        description: 'Path for output PDF. If omitted, derives from input filename (e.g. report.docx → report.pdf)',
      },
      password: {
        type: 'string',
        description: 'Password for protected input file',
      },
      pages: {
        type: 'object',
        properties: {
          start: { type: 'integer', default: 0, description: 'Start page (0-based)' },
          end: { type: 'integer', default: -1, description: 'End page (0-based, -1 = last)' },
        },
      },
      htmlLayout: {
        type: 'object',
        description: 'Layout options for HTML input',
        properties: {
          orientation: { type: 'string', enum: ['portrait', 'landscape'] },
          size: {
            oneOf: [
              { type: 'string', enum: ['A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'Letter', 'Legal'] },
              {
                type: 'object',
                properties: { width: { type: 'number' }, height: { type: 'number' } },
              },
            ],
          },
          margin: {
            type: 'object',
            properties: {
              left: { type: 'number' },
              top: { type: 'number' },
              right: { type: 'number' },
              bottom: { type: 'number' },
            },
          },
        },
      },
    },
  },

  async execute(args, ctx): Promise<ToolResponse> {
    try {
      const outputPath = args.outputPath || deriveOutputPath(args.filePath, 'pdf');
      assertOutputDiffersFromInput(args.filePath, outputPath, ctx.sandboxDir);

      const fileRef = readFileReference(args.filePath, ctx.sandboxDir);
      const fileRefs = new Map<string, FileReference>([[fileRef.key, fileRef]]);

      // Build the part entry
      const part: Record<string, unknown> = {
        file: fileRef.url ?? fileRef.key,
      };
      if (args.password) part.password = args.password;
      if (args.pages) part.pages = args.pages;
      if (args.htmlLayout) part.layout = args.htmlLayout;

      const instructions = {
        parts: [part],
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
        operation: 'convert_to_pdf',
        requestCost: response.creditsUsed ?? 0,
        remainingCredits: response.creditsRemaining,
      });

      return {
        success: true,
        output: `PDF created at ${writtenPath}`,
        credits_used: response.creditsUsed ?? undefined,
      };
    } catch (e) {
      return formatError(e);
    }
  },
};
