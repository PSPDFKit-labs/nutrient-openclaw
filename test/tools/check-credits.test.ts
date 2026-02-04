import { describe, it, expect, beforeEach } from 'vitest';
import { checkCreditsTool } from '../../src/tools/check-credits.js';
import { mockContext } from '../helpers.js';
import type { ToolContext } from '../../src/types.js';

describe('nutrient_check_credits', () => {
  let ctx: ToolContext;

  beforeEach(() => {
    ctx = mockContext();
  });

  it('has correct name and description', () => {
    expect(checkCreditsTool.name).toBe('nutrient_check_credits');
    expect(checkCreditsTool.description).toBeTruthy();
  });

  it('balance action returns remaining credits', async () => {
    // Log some credits first
    ctx.credits.log({ operation: 'ocr', requestCost: 5, remainingCredits: 95 });

    const result = await checkCreditsTool.execute({ action: 'balance' }, ctx);
    expect(result.success).toBe(true);
    const data = JSON.parse(result.output!);
    expect(data.remaining).toBe(95);
  });

  it('balance returns null when no entries', async () => {
    const result = await checkCreditsTool.execute({ action: 'balance' }, ctx);
    expect(result.success).toBe(true);
    const data = JSON.parse(result.output!);
    expect(data.remaining).toBeNull();
  });

  it('usage action returns breakdown by operation', async () => {
    ctx.credits.log({ operation: 'ocr', requestCost: 5, remainingCredits: 95 });
    ctx.credits.log({ operation: 'convert', requestCost: 1, remainingCredits: 94 });

    const result = await checkCreditsTool.execute(
      { action: 'usage', period: 'all' },
      ctx,
    );
    expect(result.success).toBe(true);
    const data = JSON.parse(result.output!);
    expect(data.totalOperations).toBe(2);
    expect(data.totalCredits).toBe(6);
    expect(data.breakdown).toHaveLength(2);
  });

  it('usage defaults to week period', async () => {
    ctx.credits.log({ operation: 'ocr', requestCost: 3, remainingCredits: 97 });
    const result = await checkCreditsTool.execute({ action: 'usage' }, ctx);
    expect(result.success).toBe(true);
    const data = JSON.parse(result.output!);
    expect(data.period).toBeDefined();
  });

  it('usage with day period filters correctly', async () => {
    ctx.credits.log({ operation: 'ocr', requestCost: 2, remainingCredits: 98 });
    const result = await checkCreditsTool.execute(
      { action: 'usage', period: 'day' },
      ctx,
    );
    expect(result.success).toBe(true);
    const data = JSON.parse(result.output!);
    expect(data.totalCredits).toBe(2);
  });

  it('returns error for unknown action', async () => {
    const result = await checkCreditsTool.execute({ action: 'invalid' }, ctx);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Unknown action');
  });
});
