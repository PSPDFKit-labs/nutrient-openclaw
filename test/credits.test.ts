import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { JsonlCreditTracker } from '../src/credits.js';

let dataDir: string;

beforeEach(() => {
  dataDir = mkdtempSync(path.join(tmpdir(), 'nutrient-credits-'));
});

describe('JsonlCreditTracker', () => {
  it('creates JSONL file on first log()', () => {
    const tracker = new JsonlCreditTracker(dataDir);
    tracker.log({ operation: 'test', requestCost: 1, remainingCredits: 99 });
    const file = path.join(dataDir, '.nutrient-credits.jsonl');
    expect(fs.existsSync(file)).toBe(true);
  });

  it('appends entries to existing file', () => {
    const tracker = new JsonlCreditTracker(dataDir);
    tracker.log({ operation: 'a', requestCost: 1, remainingCredits: 99 });
    tracker.log({ operation: 'b', requestCost: 2, remainingCredits: 97 });
    const file = path.join(dataDir, '.nutrient-credits.jsonl');
    const lines = fs.readFileSync(file, 'utf-8').trim().split('\n');
    expect(lines).toHaveLength(2);
  });

  it('getBalance() returns most recent entry with remainingCredits', () => {
    const tracker = new JsonlCreditTracker(dataDir);
    tracker.log({ operation: 'a', requestCost: 1, remainingCredits: 100 });
    tracker.log({ operation: 'b', requestCost: 2, remainingCredits: 50 });
    const balance = tracker.getBalance();
    expect(balance).not.toBeNull();
    expect(balance!.remaining).toBe(50);
  });

  it('getBalance() returns null when no entries', () => {
    const tracker = new JsonlCreditTracker(dataDir);
    expect(tracker.getBalance()).toBeNull();
  });

  it('getBalance() skips entries without remainingCredits', () => {
    const tracker = new JsonlCreditTracker(dataDir);
    tracker.log({ operation: 'a', requestCost: 1, remainingCredits: 100 });
    tracker.log({ operation: 'b', requestCost: 1, remainingCredits: null });
    const balance = tracker.getBalance();
    expect(balance!.remaining).toBe(100);
  });

  it('getUsage("day") filters to today', () => {
    const tracker = new JsonlCreditTracker(dataDir);
    tracker.log({
      operation: 'ocr',
      requestCost: 5,
      remainingCredits: 95,
      timestamp: new Date().toISOString(),
    });
    // Old entry from 2020
    const file = path.join(dataDir, '.nutrient-credits.jsonl');
    fs.appendFileSync(
      file,
      JSON.stringify({
        operation: 'old',
        requestCost: 10,
        remainingCredits: 90,
        timestamp: '2020-01-01T00:00:00.000Z',
      }) + '\n',
    );
    const usage = tracker.getUsage('day');
    expect(usage.totalCredits).toBe(5);
    expect(usage.totalOperations).toBe(1);
  });

  it('getUsage("week") filters to last 7 days', () => {
    const tracker = new JsonlCreditTracker(dataDir);
    tracker.log({
      operation: 'ocr',
      requestCost: 3,
      remainingCredits: 97,
      timestamp: new Date().toISOString(),
    });
    const usage = tracker.getUsage('week');
    expect(usage.totalCredits).toBe(3);
  });

  it('getUsage("all") returns everything', () => {
    const tracker = new JsonlCreditTracker(dataDir);
    tracker.log({ operation: 'a', requestCost: 1, remainingCredits: 99 });
    tracker.log({ operation: 'b', requestCost: 2, remainingCredits: 97 });
    const usage = tracker.getUsage('all');
    expect(usage.totalCredits).toBe(3);
    expect(usage.totalOperations).toBe(2);
  });

  it('getUsage() groups by operation', () => {
    const tracker = new JsonlCreditTracker(dataDir);
    tracker.log({ operation: 'ocr', requestCost: 5, remainingCredits: 95 });
    tracker.log({ operation: 'ocr', requestCost: 3, remainingCredits: 92 });
    tracker.log({ operation: 'convert', requestCost: 1, remainingCredits: 91 });
    const usage = tracker.getUsage('all');
    expect(usage.breakdown).toHaveLength(2);
    const ocrGroup = usage.breakdown.find((b) => b.operation === 'ocr');
    expect(ocrGroup!.count).toBe(2);
    expect(ocrGroup!.credits).toBe(8);
  });

  it('handles corrupt JSONL lines gracefully', () => {
    const file = path.join(dataDir, '.nutrient-credits.jsonl');
    fs.writeFileSync(
      file,
      '{"operation":"a","requestCost":1,"remainingCredits":99,"timestamp":"2025-01-01T00:00:00.000Z"}\nNOT JSON\n{"operation":"b","requestCost":2,"remainingCredits":97,"timestamp":"2025-01-01T00:00:00.000Z"}\n',
    );
    const tracker = new JsonlCreditTracker(dataDir);
    const usage = tracker.getUsage('all');
    expect(usage.totalOperations).toBe(2);
  });

  it('handles missing file gracefully', () => {
    const tracker = new JsonlCreditTracker(dataDir);
    expect(tracker.getUsage('all').totalOperations).toBe(0);
    expect(tracker.getBalance()).toBeNull();
  });
});
