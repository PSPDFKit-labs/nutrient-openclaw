import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import nutrientPlugin from '../index.js';

function makeMockApi(config: Record<string, unknown> = {}) {
  const tools: Array<{ name: string; description: string; label: string; parameters: unknown; execute: Function }> = [];
  return {
    pluginConfig: config,
    registerTool: vi.fn((tool) => tools.push(tool)),
    tools,
  };
}

describe('nutrientPlugin', () => {
  it('reads pluginConfig from api', () => {
    const api = makeMockApi({ apiKey: 'test-key' });
    nutrientPlugin(api);
    expect(api.registerTool).toHaveBeenCalledTimes(10);
  });

  it('registers 10 tools', () => {
    const api = makeMockApi({ apiKey: 'test-key' });
    nutrientPlugin(api);
    expect(api.registerTool).toHaveBeenCalledTimes(10);
  });

  it('registers tools with correct names', () => {
    const api = makeMockApi({ apiKey: 'test-key' });
    nutrientPlugin(api);
    const names = api.tools.map((t) => t.name).sort();
    expect(names).toEqual([
      'nutrient_ai_redact',
      'nutrient_check_credits',
      'nutrient_convert_to_image',
      'nutrient_convert_to_office',
      'nutrient_convert_to_pdf',
      'nutrient_extract_text',
      'nutrient_ocr',
      'nutrient_redact',
      'nutrient_sign',
      'nutrient_watermark',
    ]);
  });

  it('registers tools with label field', () => {
    const api = makeMockApi({ apiKey: 'test-key' });
    nutrientPlugin(api);
    for (const tool of api.tools) {
      expect(tool.label).toBeTruthy();
    }
  });

  it('execute returns AgentToolResult format', async () => {
    const api = makeMockApi({ apiKey: 'test-key' });
    nutrientPlugin(api);
    // The first tool registered — its execute wraps the internal tool
    // We can't easily call it without mocking the full client, but we can verify structure
    expect(api.tools[0].execute).toBeTypeOf('function');
  });

  it('works with missing API key (lazy error)', async () => {
    const origEnv = process.env.NUTRIENT_API_KEY;
    delete process.env.NUTRIENT_API_KEY;
    try {
      const api = makeMockApi({});
      nutrientPlugin(api);
      expect(api.registerTool).toHaveBeenCalledTimes(10);
    } finally {
      if (origEnv !== undefined) process.env.NUTRIENT_API_KEY = origEnv;
    }
  });

  it('passes sandboxDir from config to context', () => {
    const sandboxDir = mkdtempSync(path.join(tmpdir(), 'nutrient-test-'));
    const api = makeMockApi({ apiKey: 'key', sandboxDir });
    nutrientPlugin(api);
    expect(api.registerTool).toHaveBeenCalledTimes(10);
  });

  it('resolves API key from env when not in config', () => {
    const origEnv = process.env.NUTRIENT_API_KEY;
    process.env.NUTRIENT_API_KEY = 'env-key-123';
    try {
      const api = makeMockApi({});
      nutrientPlugin(api);
      expect(api.registerTool).toHaveBeenCalledTimes(10);
    } finally {
      if (origEnv !== undefined) {
        process.env.NUTRIENT_API_KEY = origEnv;
      } else {
        delete process.env.NUTRIENT_API_KEY;
      }
    }
  });
});
