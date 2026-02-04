import { describe, it, expect, beforeEach } from 'vitest';
import { convertToOfficeTool } from '../../src/tools/convert-to-office.js';
import { mockContext, writeSandboxFile } from '../helpers.js';
import { NutrientApiError } from '../../src/errors.js';
import type { ToolContext } from '../../src/types.js';
import fs from 'node:fs';
import path from 'node:path';

describe('nutrient_convert_to_office', () => {
  let ctx: ToolContext;

  beforeEach(() => {
    ctx = mockContext();
  });

  it('has correct name and description', () => {
    expect(convertToOfficeTool.name).toBe('nutrient_convert_to_office');
    expect(convertToOfficeTool.description).toBeTruthy();
  });

  it('happy path: converts PDF to DOCX', async () => {
    writeSandboxFile(ctx.sandboxDir!, 'input.pdf');
    const result = await convertToOfficeTool.execute(
      { filePath: 'input.pdf', outputPath: 'output.docx', format: 'docx' },
      ctx,
    );
    expect(result.success).toBe(true);
    expect(result.output).toContain('DOCX');
    expect(fs.existsSync(path.join(ctx.sandboxDir!, 'output.docx'))).toBe(true);
  });

  it('supports xlsx format', async () => {
    writeSandboxFile(ctx.sandboxDir!, 'input.pdf');
    const result = await convertToOfficeTool.execute(
      { filePath: 'input.pdf', outputPath: 'output.xlsx', format: 'xlsx' },
      ctx,
    );
    expect(result.success).toBe(true);
    expect(result.output).toContain('XLSX');
  });

  it('supports pptx format', async () => {
    writeSandboxFile(ctx.sandboxDir!, 'input.pdf');
    const result = await convertToOfficeTool.execute(
      { filePath: 'input.pdf', outputPath: 'output.pptx', format: 'pptx' },
      ctx,
    );
    expect(result.success).toBe(true);
    expect(result.output).toContain('PPTX');
  });

  it('returns error when file not found', async () => {
    const result = await convertToOfficeTool.execute(
      { filePath: 'missing.pdf', outputPath: 'out.docx', format: 'docx' },
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
    const result = await convertToOfficeTool.execute(
      { filePath: 'input.pdf', outputPath: 'out.docx', format: 'docx' },
      ctx,
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('API error');
  });
});
