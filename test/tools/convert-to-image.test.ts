import { describe, it, expect, beforeEach } from 'vitest';
import { convertToImageTool } from '../../src/tools/convert-to-image.js';
import { mockContext, writeSandboxFile } from '../helpers.js';
import { NutrientApiError } from '../../src/errors.js';
import type { ToolContext } from '../../src/types.js';
import fs from 'node:fs';
import path from 'node:path';

describe('nutrient_convert_to_image', () => {
  let ctx: ToolContext;

  beforeEach(() => {
    ctx = mockContext();
  });

  it('has correct name and description', () => {
    expect(convertToImageTool.name).toBe('nutrient_convert_to_image');
    expect(convertToImageTool.description).toBeTruthy();
  });

  it('happy path: renders PDF as image', async () => {
    writeSandboxFile(ctx.sandboxDir!, 'input.pdf');
    const result = await convertToImageTool.execute(
      { filePath: 'input.pdf', outputPath: 'output.png' },
      ctx,
    );
    expect(result.success).toBe(true);
    expect(result.output).toContain('output.png');
    expect(fs.existsSync(path.join(ctx.sandboxDir!, 'output.png'))).toBe(true);
  });

  it('passes format, DPI, width, height in instructions', async () => {
    writeSandboxFile(ctx.sandboxDir!, 'input.pdf');
    await convertToImageTool.execute(
      {
        filePath: 'input.pdf',
        outputPath: 'out.jpeg',
        format: 'jpeg',
        dpi: 300,
        width: 800,
        height: 600,
      },
      ctx,
    );
    expect(ctx.client.post).toHaveBeenCalledWith('build', expect.anything());
  });

  it('passes page ranges', async () => {
    writeSandboxFile(ctx.sandboxDir!, 'input.pdf');
    await convertToImageTool.execute(
      { filePath: 'input.pdf', outputPath: 'out.png', pages: { start: 0, end: 0 } },
      ctx,
    );
    expect(ctx.client.post).toHaveBeenCalled();
  });

  it('returns error when file not found', async () => {
    const result = await convertToImageTool.execute(
      { filePath: 'nonexistent.pdf', outputPath: 'out.png' },
      ctx,
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('File');
  });

  it('returns formatted error on API failure', async () => {
    writeSandboxFile(ctx.sandboxDir!, 'input.pdf');
    ctx.client = {
      post: async () => { throw new NutrientApiError(500, 'Server Error'); },
    };
    const result = await convertToImageTool.execute(
      { filePath: 'input.pdf', outputPath: 'out.png' },
      ctx,
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('API error');
  });

  it('prevents same input/output path', async () => {
    writeSandboxFile(ctx.sandboxDir!, 'same.pdf');
    const result = await convertToImageTool.execute(
      { filePath: 'same.pdf', outputPath: 'same.pdf' },
      ctx,
    );
    expect(result.success).toBe(false);
  });
});
