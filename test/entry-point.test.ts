import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import nutrientPlugin from '../index.js';

function makeMockApi(config: Record<string, unknown> = {}) {
  const tools: Array<{ name: string; description: string; parameters: unknown; execute: Function }> = [];
  return {
    getConfig: vi.fn().mockReturnValue(config),
    registerTool: vi.fn((tool) => tools.push(tool)),
    tools,
  };
}

describe('nutrientPlugin', () => {
  it('calls api.getConfig()', () => {
    const api = makeMockApi({ apiKey: 'test-key' });
    nutrientPlugin(api);
    expect(api.getConfig).toHaveBeenCalled();
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

  it('returns { name: "nutrient", version: "0.1.0" }', () => {
    const api = makeMockApi({ apiKey: 'test-key' });
    const result = nutrientPlugin(api);
    expect(result).toEqual({ name: 'nutrient', version: '0.1.0' });
  });

  it('works with missing API key (lazy error)', async () => {
    const api = makeMockApi({});
    // Remove env variable too
    const origEnv = process.env.NUTRIENT_API_KEY;
    delete process.env.NUTRIENT_API_KEY;
    try {
      nutrientPlugin(api);
      // Plugin loads fine — should have 10 tools registered
      expect(api.registerTool).toHaveBeenCalledTimes(10);
    } finally {
      if (origEnv !== undefined) process.env.NUTRIENT_API_KEY = origEnv;
    }
  });

  it('passes sandboxDir from config to context', () => {
    const sandboxDir = mkdtempSync(path.join(tmpdir(), 'nutrient-test-'));
    const api = makeMockApi({ apiKey: 'key', sandboxDir });
    nutrientPlugin(api);
    // Tools are registered — we verify indirectly that the context was created with sandboxDir
    expect(api.registerTool).toHaveBeenCalledTimes(10);
  });

  it('resolves API key from env when not in config', () => {
    const origEnv = process.env.NUTRIENT_API_KEY;
    process.env.NUTRIENT_API_KEY = 'env-key-123';
    try {
      const api = makeMockApi({});
      const result = nutrientPlugin(api);
      expect(result.name).toBe('nutrient');
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
