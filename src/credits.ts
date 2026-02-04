/**
 * JSONL-based credit tracker. Replaces the MCP server's SQLite implementation.
 *
 * Ported from: /tmp/nutrient-dws-mcp-server/src/credits/storage.ts (logUsage, getLatestBalance)
 * and /tmp/nutrient-dws-mcp-server/src/credits/aggregator.ts (getUsageSummaryAgg, resolvePeriod)
 *
 * Changes: JSONL file instead of SQLite, sync I/O, no native modules.
 */

import fs from 'node:fs';
import path from 'node:path';
import type {
  CreditTracker,
  CreditLogEntry,
  CreditBalance,
  CreditUsageSummary,
} from './types.js';

const CREDITS_FILENAME = '.nutrient-credits.jsonl';

export class JsonlCreditTracker implements CreditTracker {
  private readonly filePath: string;

  constructor(dataDir?: string) {
    const dir = dataDir || process.cwd();
    this.filePath = path.join(dir, CREDITS_FILENAME);
  }

  /**
   * Append a credit usage entry. Called by every tool after a successful API call.
   * Failures are silently swallowed — credit tracking must never break tool execution.
   */
  log(entry: CreditLogEntry): void {
    const record: CreditLogEntry = {
      ...entry,
      timestamp: entry.timestamp || new Date().toISOString(),
    };
    try {
      fs.appendFileSync(this.filePath, JSON.stringify(record) + '\n');
    } catch {
      // Silent — credit logging is best-effort
    }
  }

  /**
   * Return the most recent known credit balance, or null if no entries exist.
   */
  getBalance(): CreditBalance | null {
    const entries = this.readEntries();
    for (let i = entries.length - 1; i >= 0; i--) {
      if (entries[i].remainingCredits != null) {
        return {
          remaining: entries[i].remainingCredits!,
          asOf: entries[i].timestamp!,
        };
      }
    }
    return null;
  }

  /**
   * Aggregate credit usage by operation within a time period.
   *
   * Ported from: /tmp/nutrient-dws-mcp-server/src/credits/aggregator.ts (getUsageSummaryAgg)
   */
  getUsage(period: 'day' | 'week' | 'month' | 'all'): CreditUsageSummary {
    const range = resolvePeriod(period);
    const entries = this.readEntries();

    const filtered = entries.filter((e) => {
      const ts = e.timestamp!;
      return ts >= range.start && ts <= range.end;
    });

    const groups = new Map<string, { count: number; credits: number }>();
    for (const entry of filtered) {
      const existing = groups.get(entry.operation) ?? { count: 0, credits: 0 };
      existing.count++;
      existing.credits += entry.requestCost;
      groups.set(entry.operation, existing);
    }

    const breakdown = Array.from(groups.entries())
      .map(([operation, { count, credits }]) => ({
        operation,
        count,
        credits: round2(credits),
        avgCost: round2(credits / count),
      }))
      .sort((a, b) => b.credits - a.credits);

    return {
      period: range,
      totalCredits: round2(filtered.reduce((sum, e) => sum + e.requestCost, 0)),
      totalOperations: filtered.length,
      breakdown,
    };
  }

  /**
   * Read all entries from the JSONL file, skipping corrupt lines gracefully.
   */
  private readEntries(): CreditLogEntry[] {
    try {
      if (!fs.existsSync(this.filePath)) return [];
      const content = fs.readFileSync(this.filePath, 'utf-8');
      return content
        .split('\n')
        .filter((line) => line.trim())
        .map((line) => {
          try {
            return JSON.parse(line) as CreditLogEntry;
          } catch {
            return null;
          }
        })
        .filter((entry): entry is CreditLogEntry => entry !== null);
    } catch {
      return [];
    }
  }
}

/** Round to 2 decimal places. */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Convert a period name to an ISO date range.
 *
 * Ported from: /tmp/nutrient-dws-mcp-server/src/credits/aggregator.ts (resolvePeriod)
 */
function resolvePeriod(period: 'day' | 'week' | 'month' | 'all'): { start: string; end: string } {
  const now = new Date();
  const end = now.toISOString();

  switch (period) {
    case 'day': {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      return { start: start.toISOString(), end };
    }
    case 'week': {
      const start = new Date(now);
      start.setDate(start.getDate() - 7);
      return { start: start.toISOString(), end };
    }
    case 'month': {
      const start = new Date(now);
      start.setDate(start.getDate() - 30);
      return { start: start.toISOString(), end };
    }
    case 'all':
      return { start: '1970-01-01T00:00:00.000Z', end };
  }
}
