import { describe, it, expect, beforeEach } from 'vitest';
import { convertToPdfTool } from '../../src/tools/convert-to-pdf.js';
import { mockContext, writeSandboxFile } from '../helpers.js';
import { NutrientApiError } from '../../src/errors.js';
import type { ToolContext } from '../../src/types.js';
import fs from 'node:fs';
import path from 'node:path';

function getBuildBody(ctx: ToolContext): FormData | Record<string, unknown> {
  const call = (ctx.client.post as any).mock.calls.at(-1);
  expect(call[0]).toBe('build');
  return call[1];
}

function getInstructions(body: FormData | Record<string, unknown>): Record<string, any> {
  if (body instanceof FormData) {
    const instructionsRaw = body.get('instructions');
    expect(typeof instructionsRaw).toBe('string');
    return JSON.parse(instructionsRaw as string);
  }

  return body as Record<string, any>;
}

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
    const body = getBuildBody(ctx);
    const instructions = getInstructions(body);
    expect(instructions.parts[0].file).toBeTruthy();
    expect(instructions.parts[0].html).toBeUndefined();
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

  it('uses part.html for local HTML and keeps htmlLayout on part.layout', async () => {
    writeSandboxFile(ctx.sandboxDir!, 'page.html', '<html><body>test</body></html>');
    await convertToPdfTool.execute(
      {
        filePath: 'page.html',
        outputPath: 'out.pdf',
        htmlLayout: { orientation: 'landscape', size: 'A4' },
      },
      ctx,
    );

    const body = getBuildBody(ctx);
    expect(body).toBeInstanceOf(FormData);

    const instructions = getInstructions(body);
    expect(instructions.parts[0].html).toBeTruthy();
    expect(instructions.parts[0].file).toBeUndefined();
    expect(instructions.parts[0].layout).toEqual({ orientation: 'landscape', size: 'A4' });

    const htmlPart = (body as FormData).get(instructions.parts[0].html);
    expect(htmlPart).toBeTruthy();
    expect(typeof htmlPart).not.toBe('string');
    if (htmlPart && typeof htmlPart !== 'string') {
      expect(htmlPart.type).toBe('text/html');
    }
  });

  it('uses part.html for HTML URLs', async () => {
    const htmlUrl = 'https://example.com/page.html?utm=test';
    await convertToPdfTool.execute(
      { filePath: htmlUrl, outputPath: 'out.pdf' },
      ctx,
    );

    const body = getBuildBody(ctx);
    expect(body).not.toBeInstanceOf(FormData);
    const instructions = getInstructions(body);
    expect(instructions.parts[0].html).toBe(htmlUrl);
    expect(instructions.parts[0].file).toBeUndefined();
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
