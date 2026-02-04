import { describe, it, expect, beforeEach } from 'vitest';
import { ocrTool } from '../../src/tools/ocr.js';
import { mockContext, writeSandboxFile } from '../helpers.js';
import { NutrientApiError } from '../../src/errors.js';
import type { ToolContext } from '../../src/types.js';
import fs from 'node:fs';
import path from 'node:path';

describe('nutrient_ocr', () => {
  let ctx: ToolContext;

  beforeEach(() => {
    ctx = mockContext();
  });

  it('has correct name and description', () => {
    expect(ocrTool.name).toBe('nutrient_ocr');
    expect(ocrTool.description).toBeTruthy();
  });

  it('happy path: applies OCR to PDF', async () => {
    writeSandboxFile(ctx.sandboxDir!, 'scan.pdf');
    const result = await ocrTool.execute(
      { filePath: 'scan.pdf', outputPath: 'ocr-out.pdf', language: 'english' },
      ctx,
    );
    expect(result.success).toBe(true);
    expect(result.output).toContain('ocr-out.pdf');
    expect(result.output).toContain('english');
    expect(fs.existsSync(path.join(ctx.sandboxDir!, 'ocr-out.pdf'))).toBe(true);
  });

  it('sends language in request', async () => {
    writeSandboxFile(ctx.sandboxDir!, 'scan.pdf');
    await ocrTool.execute(
      { filePath: 'scan.pdf', outputPath: 'out.pdf', language: 'german' },
      ctx,
    );
    expect(ctx.client.post).toHaveBeenCalledWith('build', expect.anything());
  });

  it('returns error when file not found', async () => {
    const result = await ocrTool.execute(
      { filePath: 'missing.pdf', outputPath: 'out.pdf', language: 'english' },
      ctx,
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('File');
  });

  it('returns formatted error on API failure', async () => {
    writeSandboxFile(ctx.sandboxDir!, 'scan.pdf');
    ctx.client = {
      post: async () => { throw new NutrientApiError(500, 'Error'); },
    };
    const result = await ocrTool.execute(
      { filePath: 'scan.pdf', outputPath: 'out.pdf', language: 'english' },
      ctx,
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('API error');
  });

  it('prevents same input/output path', async () => {
    writeSandboxFile(ctx.sandboxDir!, 'same.pdf');
    const result = await ocrTool.execute(
      { filePath: 'same.pdf', outputPath: 'same.pdf', language: 'english' },
      ctx,
    );
    expect(result.success).toBe(false);
  });
});
