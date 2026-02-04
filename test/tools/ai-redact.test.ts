import { describe, it, expect, beforeEach } from 'vitest';
import { nutrient_ai_redact } from '../../src/tools/ai-redact.js';
import { mockContext, writeSandboxFile } from '../helpers.js';
import { NutrientApiError } from '../../src/errors.js';
import type { ToolContext } from '../../src/types.js';
import fs from 'node:fs';
import path from 'node:path';

describe('nutrient_ai_redact', () => {
  let ctx: ToolContext;

  beforeEach(() => {
    ctx = mockContext();
  });

  it('has correct name and description', () => {
    expect(nutrient_ai_redact.name).toBe('nutrient_ai_redact');
    expect(nutrient_ai_redact.description).toBeTruthy();
  });

  it('happy path: AI redacts PII from document', async () => {
    writeSandboxFile(ctx.sandboxDir!, 'input.pdf');
    const result = await nutrient_ai_redact.execute(
      { filePath: 'input.pdf', outputPath: 'redacted.pdf' },
      ctx,
    );
    expect(result.success).toBe(true);
    expect(result.output).toContain('redacted.pdf');
    expect(fs.existsSync(path.join(ctx.sandboxDir!, 'redacted.pdf'))).toBe(true);
  });

  it('uses ai/redact endpoint', async () => {
    writeSandboxFile(ctx.sandboxDir!, 'input.pdf');
    await nutrient_ai_redact.execute(
      { filePath: 'input.pdf', outputPath: 'out.pdf' },
      ctx,
    );
    expect(ctx.client.post).toHaveBeenCalledWith(
      'ai/redact',
      expect.any(FormData),
      expect.objectContaining({ timeout: 300000 }),
    );
  });

  it('uses 5-minute timeout', async () => {
    writeSandboxFile(ctx.sandboxDir!, 'input.pdf');
    await nutrient_ai_redact.execute(
      { filePath: 'input.pdf', outputPath: 'out.pdf' },
      ctx,
    );
    const call = (ctx.client.post as any).mock.calls[0];
    expect(call[2]).toEqual({ timeout: 300000 });
  });

  it('forwards custom criteria', async () => {
    writeSandboxFile(ctx.sandboxDir!, 'input.pdf');
    await nutrient_ai_redact.execute(
      {
        filePath: 'input.pdf',
        outputPath: 'out.pdf',
        criteria: 'Names and phone numbers',
      },
      ctx,
    );
    expect(ctx.client.post).toHaveBeenCalled();
  });

  it('requires local file, not URL', async () => {
    const result = await nutrient_ai_redact.execute(
      {
        filePath: 'https://example.com/doc.pdf',
        outputPath: 'out.pdf',
      },
      ctx,
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('local file');
  });

  it('returns error when file not found', async () => {
    const result = await nutrient_ai_redact.execute(
      { filePath: 'missing.pdf', outputPath: 'out.pdf' },
      ctx,
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('File');
  });

  it('returns formatted error on API failure', async () => {
    writeSandboxFile(ctx.sandboxDir!, 'input.pdf');
    ctx.client = {
      post: async () => { throw new NutrientApiError(500, 'Error'); },
    };
    const result = await nutrient_ai_redact.execute(
      { filePath: 'input.pdf', outputPath: 'out.pdf' },
      ctx,
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('API error');
  });

  it('prevents same input/output path', async () => {
    writeSandboxFile(ctx.sandboxDir!, 'same.pdf');
    const result = await nutrient_ai_redact.execute(
      { filePath: 'same.pdf', outputPath: 'same.pdf' },
      ctx,
    );
    expect(result.success).toBe(false);
  });
});
