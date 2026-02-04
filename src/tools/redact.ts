/**
 * Pattern-based redaction tool — preset, regex, or text matching via /build.
 *
 * Chains two DWS actions: `createRedactions` (find matches) → `applyRedactions`
 * (permanently burn redactions into the PDF).
 */

import { FileError, formatError } from '../errors.js';
import {
  assertOutputDiffersFromInput,
  buildFormData,
  readFileReference,
  writeResponseToFile,
  deriveOutputPath,
} from '../files.js';
import type { ToolDefinition, ToolResponse } from '../types.js';

const REDACTION_PRESETS = [
  'credit-card-number',
  'date',
  'email-address',
  'international-phone-number',
  'ipv4',
  'ipv6',
  'mac-address',
  'north-american-phone-number',
  'social-security-number',
  'time',
  'url',
  'us-zip-code',
  'vin',
] as const;

export const nutrient_redact: ToolDefinition = {
  name: 'nutrient_redact',
  description:
    'Redact content from a PDF using pattern matching. Supports three strategies: ' +
    '"preset" (built-in patterns like SSN, email, credit card), ' +
    '"regex" (custom regular expression), or ' +
    '"text" (exact text match). Permanently removes matched content.',

  parameters: {
    type: 'object',
    required: ['filePath', 'strategy'],
    properties: {
      filePath: { type: 'string', description: 'Path to input PDF' },
      outputPath: { type: 'string', description: 'Path for redacted output PDF. Auto-derived from input filename with -redacted suffix if omitted.' },
      strategy: {
        type: 'string',
        enum: ['preset', 'regex', 'text'],
        description: 'Redaction strategy',
      },
      preset: {
        type: 'string',
        enum: REDACTION_PRESETS as unknown as string[],
        description: 'Preset pattern (required when strategy="preset")',
      },
      regex: {
        type: 'string',
        description: 'Regex pattern (required when strategy="regex")',
      },
      text: {
        type: 'string',
        description: 'Text to find and redact (required when strategy="text")',
      },
      caseSensitive: {
        type: 'boolean',
        description: 'Case sensitivity (default: true for regex, false for text)',
      },
      includeAnnotations: {
        type: 'boolean',
        default: true,
        description: 'Also redact matching annotation content',
      },
      startPage: {
        type: 'integer',
        description: 'Start page index (0-based)',
      },
      pageLimit: {
        type: 'integer',
        description: 'Number of pages to search from startPage',
      },
    },
  },

  async execute(args, ctx): Promise<ToolResponse> {
    try {
      const {
        filePath,
        outputPath: rawOutputPath,
        strategy,
        preset,
        regex,
        text,
        caseSensitive,
        includeAnnotations = true,
        startPage,
        pageLimit,
      } = args as {
        filePath: string;
        outputPath?: string;
        strategy: 'preset' | 'regex' | 'text';
        preset?: string;
        regex?: string;
        text?: string;
        caseSensitive?: boolean;
        includeAnnotations?: boolean;
        startPage?: number;
        pageLimit?: number;
      };

      const outputPath = rawOutputPath || deriveOutputPath(filePath, 'pdf', '-redacted');

      // Validate strategy-specific required fields
      if (strategy === 'preset' && !preset) {
        throw new FileError('preset is required when strategy is "preset"');
      }
      if (strategy === 'regex' && !regex) {
        throw new FileError('regex is required when strategy is "regex"');
      }
      if (strategy === 'text' && !text) {
        throw new FileError('text is required when strategy is "text"');
      }

      assertOutputDiffersFromInput(filePath, outputPath, ctx.sandboxDir);

      const fileRef = readFileReference(filePath, ctx.sandboxDir);
      const fileRefs = new Map([[fileRef.key, fileRef]]);

      // Build strategy options — only include what the strategy needs
      const strategyOptions: Record<string, unknown> = { includeAnnotations };

      if (startPage != null) strategyOptions.start = startPage;
      if (pageLimit != null) strategyOptions.limit = pageLimit;

      if (strategy === 'preset') {
        strategyOptions.preset = preset;
      }
      if (strategy === 'regex') {
        strategyOptions.regex = regex;
        strategyOptions.caseSensitive = caseSensitive ?? true;
      }
      if (strategy === 'text') {
        strategyOptions.text = text;
        strategyOptions.caseSensitive = caseSensitive ?? false;
      }

      const instructions = {
        parts: [{ file: fileRef.key }],
        actions: [
          { type: 'createRedactions', strategy, strategyOptions },
          { type: 'applyRedactions' },
        ],
        output: { type: 'pdf' },
      };

      const body = buildFormData(instructions, fileRefs);
      const response = await ctx.client.post('build', body);

      const resolvedOutput = writeResponseToFile(
        response.data as ArrayBuffer,
        outputPath,
        ctx.sandboxDir,
      );

      if (response.creditsUsed != null) {
        ctx.credits.log({
          operation: 'redact',
          requestCost: response.creditsUsed,
          remainingCredits: response.creditsRemaining,
        });
      }

      return {
        success: true,
        output: `Redacted: ${resolvedOutput}`,
        credits_used: response.creditsUsed ?? undefined,
      };
    } catch (e) {
      return formatError(e);
    }
  },
};
