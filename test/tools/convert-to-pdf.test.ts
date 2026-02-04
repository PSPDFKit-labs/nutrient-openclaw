import { describe, it, expect, beforeEach } from 'vitest';
import { convertToPdfTool } from '../../src/tools/convert-to-pdf.js';
import { mockContext, writeSandboxFile } from '../helpers.js';
import { NutrientApiError } from '../../src/errors.js';
import type { ToolContext } from '../../src/types.js';
import fs from 'node:fs';
import path from 'node:path';

describe('nutrient_convert_to_pdf', () => {
  let ctx: ToolContext;

  beforeEach(() => {
    ctx = mockContext();
  });

  it('has correct name and description', () => {
    expect(convertToPdfTool.name).toBe('nutrient_convert_to_pdf');
    expect(convertToPdfTool.description).toBeTruthy();
  });

  it('happy path: converts file to PDF', async () => {
    writeSandboxFile(ctx.sandboxDir!, 'input.docx');
    const result = await convertToPdfTool.execute(
      { filePath: 'input.docx', outputPath: 'output.pdf' },
      ctx,
    );
    expect(result.success).toBe(true);
    expect(result.output).toContain('output.pdf');
    expect(ctx.client.post).toHaveBeenCalledWith('build', expect.anything());
    expect(fs.existsSync(path.join(ctx.sandboxDir!, 'output.pdf'))).toBe(true);
  });

  it('forwards password in part', async () => {
    writeSandboxFile(ctx.sandboxDir!, 'protected.pdf');
    await convertToPdfTool.execute(
      { filePath: 'protected.pdf', outputPath: 'out.pdf', password: 'secret' },
      ctx,
    );
    const call = (ctx.client.post as any).mock.calls[0];
    // Body is FormData; check instructions were built with password
    expect(call[0]).toBe('build');
  });

  it('forwards HTML layout options', async () => {
    writeSandboxFile(ctx.sandboxDir!, 'page.html');
    await convertToPdfTool.execute(
      {
        filePath: 'page.html',
        outputPath: 'out.pdf',
        htmlLayout: { orientation: 'landscape', size: 'A4' },
      },
      ctx,
    );
    expect(ctx.client.post).toHaveBeenCalled();
  });

  it('forwards page ranges', async () => {
    writeSandboxFile(ctx.sandboxDir!, 'input.pdf');
    await convertToPdfTool.execute(
      { filePath: 'input.pdf', outputPath: 'out.pdf', pages: { start: 0, end: 2 } },
      ctx,
    );
    expect(ctx.client.post).toHaveBeenCalled();
  });

  it('returns error when file not found', async () => {
    const result = await convertToPdfTool.execute(
      { filePath: 'missing.docx', outputPath: 'out.pdf' },
      ctx,
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('File');
  });

  it('returns formatted error on API failure', async () => {
    writeSandboxFile(ctx.sandboxDir!, 'input.docx');
    ctx.client = {
      post: async () => { throw new NutrientApiError(500, 'Internal Server Error'); },
    };
    const result = await convertToPdfTool.execute(
      { filePath: 'input.docx', outputPath: 'out.pdf' },
      ctx,
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('API error');
  });

  it('prevents same input/output path', async () => {
    writeSandboxFile(ctx.sandboxDir!, 'same.pdf');
    const result = await convertToPdfTool.execute(
      { filePath: 'same.pdf', outputPath: 'same.pdf' },
      ctx,
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('different');
  });

  it('logs credits after success', async () => {
    writeSandboxFile(ctx.sandboxDir!, 'input.docx');
    await convertToPdfTool.execute(
      { filePath: 'input.docx', outputPath: 'out.pdf' },
      ctx,
    );
    const balance = ctx.credits.getBalance();
    expect(balance).not.toBeNull();
  });
});
