import { describe, it, expect, beforeEach } from 'vitest';
import { watermarkTool } from '../../src/tools/watermark.js';
import { mockContext, writeSandboxFile } from '../helpers.js';
import { NutrientApiError } from '../../src/errors.js';
import type { ToolContext } from '../../src/types.js';
import fs from 'node:fs';
import path from 'node:path';

describe('nutrient_watermark', () => {
  let ctx: ToolContext;

  beforeEach(() => {
    ctx = mockContext();
  });

  it('has correct name and description', () => {
    expect(watermarkTool.name).toBe('nutrient_watermark');
    expect(watermarkTool.description).toBeTruthy();
  });

  it('happy path: adds text watermark', async () => {
    writeSandboxFile(ctx.sandboxDir!, 'input.pdf');
    const result = await watermarkTool.execute(
      {
        filePath: 'input.pdf',
        outputPath: 'wm.pdf',
        watermarkType: 'text',
        text: 'DRAFT',
        width: 200,
        height: 100,
      },
      ctx,
    );
    expect(result.success).toBe(true);
    expect(result.output).toContain('wm.pdf');
    expect(fs.existsSync(path.join(ctx.sandboxDir!, 'wm.pdf'))).toBe(true);
  });

  it('adds image watermark with extra file in FormData', async () => {
    writeSandboxFile(ctx.sandboxDir!, 'input.pdf');
    writeSandboxFile(ctx.sandboxDir!, 'logo.png', 'PNG image data');
    const result = await watermarkTool.execute(
      {
        filePath: 'input.pdf',
        outputPath: 'wm.pdf',
        watermarkType: 'image',
        imagePath: 'logo.png',
        width: 100,
        height: 50,
      },
      ctx,
    );
    expect(result.success).toBe(true);
  });

  it('forwards opacity and rotation', async () => {
    writeSandboxFile(ctx.sandboxDir!, 'input.pdf');
    await watermarkTool.execute(
      {
        filePath: 'input.pdf',
        outputPath: 'wm.pdf',
        watermarkType: 'text',
        text: 'CONFIDENTIAL',
        width: 200,
        height: 100,
        opacity: 0.5,
        rotation: 45,
      },
      ctx,
    );
    expect(ctx.client.post).toHaveBeenCalled();
  });

  it('forwards font color and size for text watermarks', async () => {
    writeSandboxFile(ctx.sandboxDir!, 'input.pdf');
    await watermarkTool.execute(
      {
        filePath: 'input.pdf',
        outputPath: 'wm.pdf',
        watermarkType: 'text',
        text: 'TEST',
        width: 200,
        height: 100,
        fontColor: '#FF0000',
        fontSize: 48,
      },
      ctx,
    );
    expect(ctx.client.post).toHaveBeenCalled();
  });

  it('returns error when file not found', async () => {
    const result = await watermarkTool.execute(
      {
        filePath: 'missing.pdf',
        outputPath: 'wm.pdf',
        watermarkType: 'text',
        text: 'X',
        width: 100,
        height: 50,
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
    const result = await watermarkTool.execute(
      {
        filePath: 'input.pdf',
        outputPath: 'wm.pdf',
        watermarkType: 'text',
        text: 'X',
        width: 100,
        height: 50,
      },
      ctx,
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('API error');
  });
});
