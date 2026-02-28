/**
 * Extraction tool: extract text, tables, or key-value pairs from documents.
 *
 * Uses the DWS `/build` endpoint with `output.type = "json-content"`.
 * Unlike file-output tools, extraction returns JSON inline — no file is written.
 */

import type { ToolDefinition, ToolContext, ToolResponse } from '../types.js';
import { formatError } from '../errors.js';
import { readFileReference, buildFormData } from '../files.js';

type ExtractionMode = 'text' | 'tables' | 'key-values';

const MODE_FLAGS: Record<ExtractionMode, string> = {
  'text': 'plainText',
  'tables': 'tables',
  'key-values': 'keyValuePairs',
};

export const nutrient_extract_text: ToolDefinition = {
  name: 'nutrient_extract_text',

  description:
    'Extract content from a document. Supports three modes: ' +
    '"text" for plain text, "tables" for tabular data, and ' +
    '"key-values" for detected key-value pairs (phone numbers, emails, dates, etc.).',

  parameters: {
    type: 'object',
    required: ['filePath'],
    properties: {
      filePath: {
        type: 'string',
        description: 'Path to input document (PDF, image, DOCX, etc.)',
      },
      mode: {
        type: 'string',
        enum: ['text', 'tables', 'key-values'],
        default: 'text',
        description:
          "Extraction mode: 'text' for plain text, 'tables' for tabular data, " +
          "'key-values' for detected key-value pairs (phone numbers, emails, dates, etc.)",
      },
      language: {
        type: 'string',
        description:
          "OCR language(s) for text extraction (default: 'english'). " +
          "Use a single language or a comma-separated list (for example: 'english,german').",
        default: 'english',
      },
    },
  },

  async execute(
    args: { filePath: string; mode?: ExtractionMode; language?: string },
    ctx: ToolContext,
  ): Promise<ToolResponse> {
    try {
      const { filePath, mode = 'text', language = 'english' } = args;
      const normalizedLanguage =
        typeof language === 'string' && language.includes(',')
          ? language
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          : language;

      const fileRef = readFileReference(filePath, ctx.sandboxDir);
      const fileRefs = new Map([[fileRef.key, fileRef]]);

      const output: Record<string, unknown> = {
        type: 'json-content',
        [MODE_FLAGS[mode]]: true,
        language: normalizedLanguage,
      };

      const instructions = {
        parts: [{ file: fileRef.key }],
        output,
      };

      const body = buildFormData(instructions, fileRefs);
      const response = await ctx.client.post('build', body);

      if (response.creditsUsed != null) {
        ctx.credits.log({
          operation: `extract-${mode}`,
          requestCost: response.creditsUsed,
          remainingCredits: response.creditsRemaining,
        });
      }

      const resultText =
        typeof response.data === 'string'
          ? response.data
          : Buffer.from(response.data).toString('utf-8');

      return {
        success: true,
        output: resultText,
        credits_used: response.creditsUsed ?? undefined,
      };
    } catch (e) {
      return formatError(e);
    }
  },
};
