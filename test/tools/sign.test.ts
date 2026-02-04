import { describe, it, expect, beforeEach } from 'vitest';
import { signTool } from '../../src/tools/sign.js';
import { mockContext, writeSandboxFile } from '../helpers.js';
import { NutrientApiError } from '../../src/errors.js';
import type { ToolContext } from '../../src/types.js';
import fs from 'node:fs';
import path from 'node:path';

describe('nutrient_sign', () => {
  let ctx: ToolContext;

  beforeEach(() => {
    ctx = mockContext();
  });

  it('has correct name and description', () => {
    expect(signTool.name).toBe('nutrient_sign');
    expect(signTool.description).toBeTruthy();
  });

  it('happy path: signs PDF with defaults (invisible, cms)', async () => {
    writeSandboxFile(ctx.sandboxDir!, 'input.pdf');
    const result = await signTool.execute(
      { filePath: 'input.pdf', outputPath: 'signed.pdf' },
      ctx,
    );
    expect(result.success).toBe(true);
    expect(result.output).toContain('signed.pdf');
    expect(fs.existsSync(path.join(ctx.sandboxDir!, 'signed.pdf'))).toBe(true);
  });

  it('uses /sign endpoint', async () => {
    writeSandboxFile(ctx.sandboxDir!, 'input.pdf');
    await signTool.execute(
      { filePath: 'input.pdf', outputPath: 'signed.pdf' },
      ctx,
    );
    expect(ctx.client.post).toHaveBeenCalledWith('sign', expect.any(FormData));
  });

  it('visible signature with pageIndex and rect', async () => {
    writeSandboxFile(ctx.sandboxDir!, 'input.pdf');
    const result = await signTool.execute(
      {
        filePath: 'input.pdf',
        outputPath: 'signed.pdf',
        pageIndex: 0,
        rect: [10, 10, 200, 50],
        signerName: 'John Doe',
      },
      ctx,
    );
    expect(result.success).toBe(true);
  });

  it('supports cades signature type', async () => {
    writeSandboxFile(ctx.sandboxDir!, 'input.pdf');
    const result = await signTool.execute(
      {
        filePath: 'input.pdf',
        outputPath: 'signed.pdf',
        signatureType: 'cades',
        cadesLevel: 'b-lt',
      },
      ctx,
    );
    expect(result.success).toBe(true);
  });

  it('attaches watermark image', async () => {
    writeSandboxFile(ctx.sandboxDir!, 'input.pdf');
    writeSandboxFile(ctx.sandboxDir!, 'watermark.png', 'PNG data');
    const result = await signTool.execute(
      {
        filePath: 'input.pdf',
        outputPath: 'signed.pdf',
        watermarkImagePath: 'watermark.png',
      },
      ctx,
    );
    expect(result.success).toBe(true);
  });

  it('attaches graphic image', async () => {
    writeSandboxFile(ctx.sandboxDir!, 'input.pdf');
    writeSandboxFile(ctx.sandboxDir!, 'graphic.png', 'PNG data');
    const result = await signTool.execute(
      {
        filePath: 'input.pdf',
        outputPath: 'signed.pdf',
        graphicImagePath: 'graphic.png',
      },
      ctx,
    );
    expect(result.success).toBe(true);
  });

  it('requires local file, not URL', async () => {
    const result = await signTool.execute(
      {
        filePath: 'https://example.com/doc.pdf',
        outputPath: 'signed.pdf',
      },
      ctx,
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('local file');
  });

  it('returns error when file not found', async () => {
    const result = await signTool.execute(
      { filePath: 'missing.pdf', outputPath: 'signed.pdf' },
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
    const result = await signTool.execute(
      { filePath: 'input.pdf', outputPath: 'signed.pdf' },
      ctx,
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('API error');
  });

  it('prevents same input/output path', async () => {
    writeSandboxFile(ctx.sandboxDir!, 'same.pdf');
    const result = await signTool.execute(
      { filePath: 'same.pdf', outputPath: 'same.pdf' },
      ctx,
    );
    expect(result.success).toBe(false);
  });
});
