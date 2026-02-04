import { describe, it, expect, beforeEach } from 'vitest';
import { nutrient_extract_text } from '../../src/tools/extract-text.js';
import { mockContext, writeSandboxFile } from '../helpers.js';
import { NutrientApiError } from '../../src/errors.js';
import type { ToolContext } from '../../src/types.js';

describe('nutrient_extract_text', () => {
  let ctx: ToolContext;

  beforeEach(() => {
    ctx = mockContext({ data: '{"text":"Hello world"}' });
  });

  it('has correct name and description', () => {
    expect(nutrient_extract_text.name).toBe('nutrient_extract_text');
    expect(nutrient_extract_text.description).toBeTruthy();
  });

  it('happy path: extracts text (default mode)', async () => {
    writeSandboxFile(ctx.sandboxDir!, 'doc.pdf');
    const result = await nutrient_extract_text.execute(
      { filePath: 'doc.pdf' },
      ctx,
    );
    expect(result.success).toBe(true);
    expect(result.output).toContain('Hello world');
  });

  it('supports tables mode', async () => {
    writeSandboxFile(ctx.sandboxDir!, 'doc.pdf');
    const result = await nutrient_extract_text.execute(
      { filePath: 'doc.pdf', mode: 'tables' },
      ctx,
    );
    expect(result.success).toBe(true);
    expect(ctx.client.post).toHaveBeenCalled();
  });

  it('supports key-values mode', async () => {
    writeSandboxFile(ctx.sandboxDir!, 'doc.pdf');
    const result = await nutrient_extract_text.execute(
      { filePath: 'doc.pdf', mode: 'key-values' },
      ctx,
    );
    expect(result.success).toBe(true);
  });

  it('returns string data, not a file', async () => {
    writeSandboxFile(ctx.sandboxDir!, 'doc.pdf');
    const result = await nutrient_extract_text.execute(
      { filePath: 'doc.pdf' },
      ctx,
    );
    expect(typeof result.output).toBe('string');
  });

  it('returns error when file not found', async () => {
    const result = await nutrient_extract_text.execute(
      { filePath: 'missing.pdf' },
      ctx,
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('File');
  });

  it('returns formatted error on API failure', async () => {
    writeSandboxFile(ctx.sandboxDir!, 'doc.pdf');
    ctx.client = {
      post: async () => { throw new NutrientApiError(500, 'Error'); },
    };
    const result = await nutrient_extract_text.execute(
      { filePath: 'doc.pdf' },
      ctx,
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('API error');
  });

  it('handles ArrayBuffer response data', async () => {
    ctx = mockContext({ data: new ArrayBuffer(10) });
    writeSandboxFile(ctx.sandboxDir!, 'doc.pdf');
    const result = await nutrient_extract_text.execute(
      { filePath: 'doc.pdf' },
      ctx,
    );
    expect(result.success).toBe(true);
    expect(typeof result.output).toBe('string');
  });
});
