/**
 * AI-powered redaction tool — uses /ai/redact for intelligent PII detection.
 *
 * Unlike pattern-based redaction, this endpoint uses AI to understand document
 * context and identify sensitive information based on natural-language criteria.
 * Never exposes PII in responses — the output is always a redacted binary PDF.
 *
 * Typical latency: 60–120 seconds. Timeout: 5 minutes.
 */

import { FileError, formatError } from '../errors.js';
import {
  assertOutputDiffersFromInput,
  readFileReference,
  writeResponseToFile,
} from '../files.js';
import type { ToolDefinition, ToolResponse } from '../types.js';

const AI_REDACT_TIMEOUT_MS = 300_000; // 5 minutes

export const nutrient_ai_redact: ToolDefinition = {
  name: 'nutrient_ai_redact',
  description:
    'Redact sensitive information from a document using AI analysis. ' +
    'Automatically detects and permanently removes PII based on natural-language criteria. ' +
    'Accepts any criteria string (e.g. "Names and phone numbers", "Protected health information"). ' +
    'Defaults to redacting all personally identifiable information. ' +
    'Note: AI analysis typically takes 60–120 seconds.',

  parameters: {
    type: 'object',
    required: ['filePath', 'outputPath'],
    properties: {
      filePath: {
        type: 'string',
        description: 'Path to input document',
      },
      outputPath: {
        type: 'string',
        description: 'Path for redacted output',
      },
      criteria: {
        type: 'string',
        default: 'All personally identifiable information',
        description:
          'What to redact. Examples: "Names, email addresses, and phone numbers", ' +
          '"Protected health information (PHI)", ' +
          '"Social security numbers and credit card numbers"',
      },
    },
  },

  async execute(args, ctx): Promise<ToolResponse> {
    try {
      const {
        filePath,
        outputPath,
        criteria = 'All personally identifiable information',
      } = args as {
        filePath: string;
        outputPath: string;
        criteria?: string;
      };

      assertOutputDiffersFromInput(filePath, outputPath, ctx.sandboxDir);

      const fileRef = readFileReference(filePath, ctx.sandboxDir);

      if (!fileRef.file) {
        throw new FileError('AI redaction requires a local file, not a URL');
      }

      // /ai/redact uses its own request format — not the /build instructions schema.
      // Fields: file1 (document blob), data (JSON with documents array + criteria).
      const formData = new FormData();
      const blob = new Blob([new Uint8Array(fileRef.file.buffer)]);
      formData.append('file1', blob, fileRef.name);
      formData.append(
        'data',
        JSON.stringify({
          documents: [{ documentId: 'file1' }],
          criteria,
        }),
      );

      const response = await ctx.client.post('ai/redact', formData, {
        timeout: AI_REDACT_TIMEOUT_MS,
      });

      const resolvedOutput = writeResponseToFile(
        response.data as ArrayBuffer,
        outputPath,
        ctx.sandboxDir,
      );

      if (response.creditsUsed != null) {
        ctx.credits.log({
          operation: 'ai-redact',
          requestCost: response.creditsUsed,
          remainingCredits: response.creditsRemaining,
        });
      }

      return {
        success: true,
        output: `AI redaction complete: ${resolvedOutput}`,
        credits_used: response.creditsUsed ?? undefined,
      };
    } catch (e) {
      return formatError(e);
    }
  },
};
