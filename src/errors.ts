import type { ToolResponse } from './types.js';

export class NutrientApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public creditsUsed?: number,
    public details?: unknown
  ) {
    super(message);
    this.name = 'NutrientApiError';
  }
}

export class FileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FileError';
  }
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

/**
 * Convert any error into a standardized ToolResponse.
 * Every tool's execute() wraps its body in try/catch → formatError().
 */
export function formatError(e: unknown): ToolResponse {
  if (e instanceof NutrientApiError) {
    return {
      success: false,
      error: `API error (${e.status}): ${e.message}`,
      credits_used: e.creditsUsed ?? undefined,
    };
  }
  if (e instanceof FileError) {
    return { success: false, error: `File error: ${e.message}` };
  }
  if (e instanceof ConfigError) {
    return { success: false, error: `Configuration error: ${e.message}` };
  }
  return {
    success: false,
    error: `Unexpected error: ${e instanceof Error ? e.message : String(e)}`,
  };
}
