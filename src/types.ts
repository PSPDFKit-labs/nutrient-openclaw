/**
 * Standard response returned by every tool's execute() function.
 */
export interface ToolResponse {
  success: boolean;
  output?: string;
  error?: string;
  credits_used?: number;
}

/**
 * Context object passed to every tool's execute() function.
 * Created once in the plugin entry point and shared across all tools.
 */
export interface ToolContext {
  client: NutrientClient;
  credits: CreditTracker;
  sandboxDir?: string;
}

/**
 * HTTP client interface for the Nutrient DWS API.
 */
export interface NutrientClient {
  post(endpoint: string, body: FormData | object, opts?: { timeout?: number }): Promise<NutrientResponse>;
}

/**
 * Response from the Nutrient DWS API, parsed by the HTTP client.
 */
export interface NutrientResponse {
  ok: boolean;
  status: number;
  data: ArrayBuffer | string;
  headers: Record<string, string>;
  creditsUsed: number | null;
  creditsRemaining: number | null;
}

/**
 * Credit tracking interface. Implementations may use in-memory or JSONL storage.
 */
export interface CreditTracker {
  log(entry: CreditLogEntry): void;
  getBalance(): CreditBalance | null;
  getUsage(period: 'day' | 'week' | 'month' | 'all'): CreditUsageSummary;
}

export interface CreditLogEntry {
  operation: string;
  requestCost: number;
  remainingCredits: number | null;
  timestamp?: string;
}

export interface CreditBalance {
  remaining: number;
  asOf: string;
}

export interface CreditUsageSummary {
  period: { start: string; end: string };
  totalCredits: number;
  totalOperations: number;
  breakdown: Array<{
    operation: string;
    count: number;
    credits: number;
    avgCost: number;
  }>;
}

/**
 * Tool definition shape. Every tool module exports an object matching this interface.
 */
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;  // JSON Schema
  execute: (args: any, ctx: ToolContext) => Promise<ToolResponse>;
}

/**
 * Represents a file reference used when building FormData for the DWS API.
 * Ported from MCP server's src/dws/types.ts.
 */
export interface FileReference {
  key: string;
  file?: {
    buffer: Buffer;
    path: string;
  };
  url?: string;
  name: string;
}
