import { vi } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { JsonlCreditTracker } from '../src/credits.js';
import type { NutrientClient, NutrientResponse, ToolContext } from '../src/types.js';

export function mockClient(overrides: Partial<NutrientResponse> = {}): NutrientClient {
  return {
    post: vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: new ArrayBuffer(100),
      headers: {},
      creditsUsed: 1,
      creditsRemaining: 999,
      ...overrides,
    } satisfies NutrientResponse),
  };
}

export function mockClientError(status: number, message: string): NutrientClient {
  // Dynamically import to avoid top-level await
  const { NutrientApiError } = require('../src/errors.js');
  return {
    post: vi.fn().mockRejectedValue(new NutrientApiError(status, message)),
  };
}

export function mockContext(clientOverrides: Partial<NutrientResponse> = {}): ToolContext {
  const sandboxDir = mkdtempSync(path.join(tmpdir(), 'nutrient-test-'));
  return {
    client: mockClient(clientOverrides),
    credits: new JsonlCreditTracker(sandboxDir),
    sandboxDir,
  };
}

/**
 * Write a dummy file inside the sandbox and return its basename.
 */
export function writeSandboxFile(
  sandboxDir: string,
  filename: string,
  content: string | Buffer = '%PDF-1.0 dummy',
): string {
  const filePath = path.join(sandboxDir, filename);
  writeFileSync(filePath, content);
  return filename;
}
