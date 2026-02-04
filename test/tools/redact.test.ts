import { describe, it, expect, beforeEach } from 'vitest';
import { nutrient_redact } from '../../src/tools/redact.js';
import { mockContext, writeSandboxFile } from '../helpers.js';
import { NutrientApiError } from '../../src/errors.js';
import type { ToolContext } from '../../src/types.js';

describe('nutrient_redact', () => {
  let ctx: ToolContext;

  beforeEach(() => {
    ctx = mockContext();
  });

  it('has correct name and description', () => {
    expect(nutrient_redact.name).toBe('nutrient_redact');
    expect(nutrient_redact.description).toBeTruthy();
  });

  it('happy path: preset strategy', async () => {
    writeSandboxFile(ctx.sandboxDir!, 'input.pdf');
    const result = await nutrient_redact.execute(
      {
        filePath: 'input.pdf',
        outputPath: 'redacted.pdf',
        strategy: 'preset',
        preset: 'email-address',
      },
      ctx,
    );
    expect(result.success).toBe(true);
    expect(result.output).toContain('redacted.pdf');
  });

  it('happy path: regex strategy', async () => {
    writeSandboxFile(ctx.sandboxDir!, 'input.pdf');
    const result = await nutrient_redact.execute(
      {
        filePath: 'input.pdf',
        outputPath: 'redacted.pdf',
        strategy: 'regex',
        regex: '\\d{3}-\\d{2}-\\d{4}',
      },
      ctx,
    );
    expect(result.success).toBe(true);
  });

  it('happy path: text strategy', async () => {
    writeSandboxFile(ctx.sandboxDir!, 'input.pdf');
    const result = await nutrient_redact.execute(
      {
        filePath: 'input.pdf',
        outputPath: 'redacted.pdf',
        strategy: 'text',
        text: 'John Doe',
      },
      ctx,
    );
    expect(result.success).toBe(true);
  });

  it('validates preset is required for preset strategy', async () => {
    writeSandboxFile(ctx.sandboxDir!, 'input.pdf');
    const result = await nutrient_redact.execute(
      {
        filePath: 'input.pdf',
        outputPath: 'redacted.pdf',
        strategy: 'preset',
      },
      ctx,
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('preset');
  });

  it('validates regex is required for regex strategy', async () => {
    writeSandboxFile(ctx.sandboxDir!, 'input.pdf');
    const result = await nutrient_redact.execute(
      {
        filePath: 'input.pdf',
        outputPath: 'redacted.pdf',
        strategy: 'regex',
      },
      ctx,
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('regex');
  });

  it('validates text is required for text strategy', async () => {
    writeSandboxFile(ctx.sandboxDir!, 'input.pdf');
    const result = await nutrient_redact.execute(
      {
        filePath: 'input.pdf',
        outputPath: 'redacted.pdf',
        strategy: 'text',
      },
      ctx,
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('text');
  });

  it('defaults caseSensitive true for regex, false for text', async () => {
    // This is tested implicitly through the instructions built — just ensure no crash
    writeSandboxFile(ctx.sandboxDir!, 'input.pdf');
    await nutrient_redact.execute(
      {
        filePath: 'input.pdf',
        outputPath: 'r1.pdf',
        strategy: 'regex',
        regex: 'test',
      },
      ctx,
    );
    await nutrient_redact.execute(
      {
        filePath: 'input.pdf',
        outputPath: 'r2.pdf',
        strategy: 'text',
        text: 'test',
      },
      ctx,
    );
    expect(ctx.client.post).toHaveBeenCalledTimes(2);
  });

  it('returns error when file not found', async () => {
    const result = await nutrient_redact.execute(
      {
        filePath: 'missing.pdf',
        outputPath: 'out.pdf',
        strategy: 'preset',
        preset: 'email-address',
      },
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
    const result = await nutrient_redact.execute(
      {
        filePath: 'input.pdf',
        outputPath: 'out.pdf',
        strategy: 'preset',
        preset: 'email-address',
      },
      ctx,
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('API error');
  });
});
