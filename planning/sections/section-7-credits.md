# Section 7: Credit Balance Tool

**Complexity:** S (Small)  
**Dependencies:** Section 1 (types/errors), Section 2 (client)  
**Estimated time:** 45 minutes

## Objective

Implement the credit tracking system (`src/credits.ts`) and the `nutrient_check_credits` tool (`src/tools/check-credits.ts`).

## Context

### MCP server vs our approach

The MCP server uses SQLite (`better-sqlite3`) for credit tracking — a native module that violates our zero-native-deps constraint. We replace it with:
- **Append-only JSONL file** for persistent credit logging
- **In-memory aggregation** for usage queries

The JSONL file is stored in the sandbox directory (if set) or a data directory. Each line is a JSON object:
```json
{"timestamp":"2026-02-04T15:00:00Z","operation":"convert","requestCost":1,"remainingCredits":999}
```

### Credit data source

Every DWS API response includes headers:
- `x-pspdfkit-credit-usage` — credits consumed by the request
- `x-pspdfkit-remaining-credits` — remaining balance

The `NutrientResponse` object from `client.ts` already extracts these as `creditsUsed` and `creditsRemaining`. Every tool calls `ctx.credits.log()` after each API call.

### What the tool does

The `nutrient_check_credits` tool supports two actions:
- **`balance`**: Returns current remaining credits and daily/weekly/monthly usage
- **`usage`**: Returns credit consumption breakdown by operation type for a time period

**Project root:** `/Users/nuthome/GdPicture-Java/nutrient-openclaw-plugin/`

## Files to Create

### 1. `src/credits.ts`

Implements the `CreditTracker` interface from `src/types.ts`.

```typescript
// src/credits.ts
import fs from 'node:fs';
import path from 'node:path';
import type { CreditTracker, CreditLogEntry, CreditBalance, CreditUsageSummary } from './types.js';

const CREDITS_FILENAME = '.nutrient-credits.jsonl';

/**
 * JSONL-based credit tracker. Replaces the MCP server's SQLite implementation.
 *
 * Ported from: /tmp/nutrient-dws-mcp-server/src/credits/storage.ts (logUsage, getLatestBalance)
 * and /tmp/nutrient-dws-mcp-server/src/credits/aggregator.ts (getUsageSummaryAgg, resolvePeriod)
 *
 * Changes: JSONL file instead of SQLite, sync I/O, no native modules.
 */
export class JsonlCreditTracker implements CreditTracker {
  private filePath: string;

  constructor(dataDir?: string) {
    // Store credits file in dataDir (sandbox) or current working directory
    const dir = dataDir || process.cwd();
    this.filePath = path.join(dir, CREDITS_FILENAME);
  }

  /**
   * Append a credit usage entry. Called by every tool after a successful API call.
   */
  log(entry: CreditLogEntry): void {
    const record = {
      ...entry,
      timestamp: entry.timestamp || new Date().toISOString(),
    };
    try {
      fs.appendFileSync(this.filePath, JSON.stringify(record) + '\n');
    } catch {
      // Silently fail — credit tracking should never break tool execution
    }
  }

  /**
   * Get the latest known credit balance from the most recent log entry.
   */
  getBalance(): CreditBalance | null {
    const entries = this.readEntries();
    // Find the most recent entry with remainingCredits
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
   * Get usage summary for a time period, broken down by operation.
   *
   * Ported from: /tmp/nutrient-dws-mcp-server/src/credits/aggregator.ts (getUsageSummaryAgg)
   */
  getUsage(period: 'day' | 'week' | 'month' | 'all'): CreditUsageSummary {
    const range = resolvePeriod(period);
    const entries = this.readEntries();

    // Filter by time range
    const filtered = entries.filter((e) => {
      const ts = e.timestamp!;
      return ts >= range.start && ts <= range.end;
    });

    // Group by operation
    const groups = new Map<string, { count: number; credits: number }>();
    for (const entry of filtered) {
      const key = entry.operation;
      const existing = groups.get(key) || { count: 0, credits: 0 };
      existing.count++;
      existing.credits += entry.requestCost;
      groups.set(key, existing);
    }

    const breakdown = Array.from(groups.entries())
      .map(([operation, { count, credits }]) => ({
        operation,
        count,
        credits: Math.round(credits * 100) / 100,
        avgCost: Math.round((credits / count) * 100) / 100,
      }))
      .sort((a, b) => b.credits - a.credits);

    return {
      period: range,
      totalCredits: Math.round(filtered.reduce((sum, e) => sum + e.requestCost, 0) * 100) / 100,
      totalOperations: filtered.length,
      breakdown,
    };
  }

  /**
   * Read all entries from the JSONL file.
   */
  private readEntries(): CreditLogEntry[] {
    try {
      if (!fs.existsSync(this.filePath)) return [];
      const content = fs.readFileSync(this.filePath, 'utf-8');
      return content
        .split('\n')
        .filter((line) => line.trim())
        .map((line) => {
          try { return JSON.parse(line); } catch { return null; }
        })
        .filter(Boolean);
    } catch {
      return [];
    }
  }
}

/**
 * Convert a period name to ISO date range.
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
```

### 2. `src/tools/check-credits.ts`

**Parameters (JSON Schema):**
```json
{
  "type": "object",
  "required": ["action"],
  "properties": {
    "action": {
      "type": "string",
      "enum": ["balance", "usage"],
      "description": "'balance' returns remaining credits. 'usage' returns consumption breakdown by operation type."
    },
    "period": {
      "type": "string",
      "enum": ["day", "week", "month", "all"],
      "default": "week",
      "description": "Time period for usage queries (default: 'week')"
    }
  }
}
```

**execute logic:**
```typescript
async execute(args, ctx) {
  try {
    const { action, period = 'week' } = args;

    if (action === 'balance') {
      const balance = ctx.credits.getBalance();
      const weekUsage = ctx.credits.getUsage('week');
      return {
        success: true,
        output: JSON.stringify({
          remaining: balance?.remaining ?? null,
          asOf: balance?.asOf ?? null,
          usedThisWeek: weekUsage.totalCredits,
          operationsThisWeek: weekUsage.totalOperations,
        }, null, 2),
      };
    }

    if (action === 'usage') {
      const summary = ctx.credits.getUsage(period);
      return {
        success: true,
        output: JSON.stringify(summary, null, 2),
      };
    }

    return { success: false, error: `Unknown action: ${action}` };
  } catch (e) {
    return formatError(e);
  }
}
```

## Acceptance Criteria

- [ ] `src/credits.ts` exports `JsonlCreditTracker` implementing `CreditTracker` interface
- [ ] `log()` appends JSONL entries to `.nutrient-credits.jsonl`
- [ ] `getBalance()` returns the most recent `remainingCredits` value
- [ ] `getUsage()` aggregates entries by operation within the time period
- [ ] JSONL file is created in `dataDir` (sandbox) or CWD
- [ ] Failed writes are silently ignored (never break tool execution)
- [ ] Corrupt lines in JSONL are skipped
- [ ] `src/tools/check-credits.ts` exports `ToolDefinition` named `nutrient_check_credits`
- [ ] `balance` action returns remaining credits + weekly usage
- [ ] `usage` action returns breakdown by operation for specified period
- [ ] `npm run build` succeeds

## Code to Port

| Source File | What to Port |
|---|---|
| `/tmp/nutrient-dws-mcp-server/src/credits/storage.ts` | `logUsage()` → `log()`, `getLatestBalance()` → `getBalance()`. Replace SQLite with JSONL append/read. |
| `/tmp/nutrient-dws-mcp-server/src/credits/aggregator.ts` | `resolvePeriod()` — copy with minor simplification (no `toISONoMs` needed). `getUsageSummaryAgg()` → `getUsage()` — same aggregation logic, different data source. |
| `/tmp/nutrient-dws-mcp-server/src/index.ts` | Credit tool handler (lines 130-190) — the `check_credits` tool handler logic for balance/usage/forecast actions. We drop `forecast` for v1. |

## Tests Required

Covered in Section 9. Key test cases:

**JsonlCreditTracker:**
- `log()` creates file and appends entries
- `getBalance()` returns most recent entry with remainingCredits
- `getBalance()` returns null when no entries
- `getUsage('day')` filters to today's entries only
- `getUsage('all')` includes all entries
- Corrupt JSONL lines are skipped gracefully
- Missing file returns empty results (no crash)

**nutrient_check_credits:**
- `balance` action returns remaining + weekly summary
- `usage` action returns breakdown with period filtering
- Unknown action returns error
