/**
 * Tool: nutrient_check_credits
 * Query credit balance and usage breakdown from the local JSONL credit log.
 */

import type { ToolDefinition, ToolResponse } from '../types.js';
import { formatError } from '../errors.js';

export const checkCreditsTool: ToolDefinition = {
  name: 'nutrient_check_credits',
  description:
    'Check Nutrient DWS API credit balance and usage. ' +
    "'balance' returns remaining credits and weekly summary. " +
    "'usage' returns consumption breakdown by operation type for a time period.",
  parameters: {
    type: 'object',
    required: ['action'],
    properties: {
      action: {
        type: 'string',
        enum: ['balance', 'usage'],
        description:
          "'balance' returns remaining credits. 'usage' returns consumption breakdown by operation type.",
      },
      period: {
        type: 'string',
        enum: ['day', 'week', 'month', 'all'],
        default: 'week',
        description: "Time period for usage queries (default: 'week')",
      },
    },
  },

  async execute(
    args: { action: string; period?: 'day' | 'week' | 'month' | 'all' },
    ctx,
  ): Promise<ToolResponse> {
    try {
      const { action, period = 'week' } = args;

      if (action === 'balance') {
        const balance = ctx.credits.getBalance();
        const weekUsage = ctx.credits.getUsage('week');
        return {
          success: true,
          output: JSON.stringify(
            {
              remaining: balance?.remaining ?? null,
              asOf: balance?.asOf ?? null,
              usedThisWeek: weekUsage.totalCredits,
              operationsThisWeek: weekUsage.totalOperations,
            },
            null,
            2,
          ),
        };
      }

      if (action === 'usage') {
        const summary = ctx.credits.getUsage(period);
        return {
          success: true,
          output: JSON.stringify(summary, null, 2),
        };
      }

      return { success: false, error: `Unknown action: ${action}` };
    } catch (e) {
      return formatError(e);
    }
  },
};
