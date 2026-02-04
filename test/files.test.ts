import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import {
  resolveReadPath,
  resolveWritePath,
  readFileReference,
  buildFormData,
  assertOutputDiffersFromInput,
} from '../src/files.js';
import { FileError } from '../src/errors.js';

let sandboxDir: string;

beforeEach(() => {
  sandboxDir = mkdtempSync(path.join(tmpdir(), 'nutrient-test-'));
});

describe('resolveReadPath', () => {
  it('resolves relative path against CWD when no sandbox', () => {
    const resolved = resolveReadPath('foo.pdf');
    expect(resolved).toBe(path.resolve('foo.pdf'));
  });

  it('resolves relative path against sandboxDir when set', () => {
    const resolved = resolveReadPath('foo.pdf', sandboxDir);
    expect(resolved).toBe(path.join(sandboxDir, 'foo.pdf'));
  });

  it('blocks traversal outside sandbox with ../', () => {
    expect(() => resolveReadPath('../../../etc/passwd', sandboxDir)).toThrow(FileError);
  });

  it('allows absolute path inside sandbox', () => {
    const absPath = path.join(sandboxDir, 'test.pdf');
    const resolved = resolveReadPath(absPath, sandboxDir);
    expect(resolved).toBe(absPath);
  });

  it('blocks absolute path outside sandbox', () => {
    expect(() => resolveReadPath('/etc/passwd', sandboxDir)).toThrow(FileError);
  });
});

describe('resolveWritePath', () => {
  it('creates parent directories', () => {
    const resolved = resolveWritePath('sub/dir/out.pdf', sandboxDir);
    expect(resolved).toBe(path.join(sandboxDir, 'sub', 'dir', 'out.pdf'));
    expect(fs.existsSync(path.dirname(resolved))).toBe(true);
  });

  it('respects sandbox constraints', () => {
    expect(() => resolveWritePath('../../escape.pdf', sandboxDir)).toThrow(FileError);
  });
});

describe('readFileReference', () => {
  it('returns URL reference for http:// paths', () => {
    const ref = readFileReference('http://example.com/doc.pdf');
    expect(ref.url).toBe('http://example.com/doc.pdf');
    expect(ref.file).toBeUndefined();
  });

  it('returns URL reference for https:// paths', () => {
    const ref = readFileReference('https://example.com/doc.pdf');
    expect(ref.url).toBe('https://example.com/doc.pdf');
  });

  it('reads local file and returns FileReference with buffer', () => {
    const filePath = path.join(sandboxDir, 'test.pdf');
    writeFileSync(filePath, 'PDF content');
    const ref = readFileReference('test.pdf', sandboxDir);
    expect(ref.file).toBeDefined();
    expect(ref.file!.buffer).toBeInstanceOf(Buffer);
    expect(ref.name).toBe('test.pdf');
  });

  it('throws FileError for missing file', () => {
    expect(() => readFileReference('nonexistent.pdf', sandboxDir)).toThrow(FileError);
  });

  it('sanitizes filename for FormData key', () => {
    const filePath = path.join(sandboxDir, 'my file (1).pdf');
    writeFileSync(filePath, 'content');
    const ref = readFileReference('my file (1).pdf', sandboxDir);
    expect(ref.key).toBe('my_file__1__pdf');
  });
});

describe('buildFormData', () => {
  it('returns plain object when all inputs are URLs', () => {
    const instructions = { parts: [{ file: 'https://example.com/doc.pdf' }] };
    const refs = new Map([
      ['url1', { key: 'url1', url: 'https://example.com/doc.pdf', name: 'doc.pdf' }],
    ]);
    const result = buildFormData(instructions, refs);
    expect(result).not.toBeInstanceOf(FormData);
    expect(result).toEqual(instructions);
  });

  it('returns FormData when any input is a local file', () => {
    const instructions = { parts: [{ file: 'test_pdf' }] };
    const refs = new Map([
      [
        'test_pdf',
        {
          key: 'test_pdf',
          name: 'test.pdf',
          file: { buffer: Buffer.from('data'), path: '/tmp/test.pdf' },
        },
      ],
    ]);
    const result = buildFormData(instructions, refs);
    expect(result).toBeInstanceOf(FormData);
  });
});

describe('assertOutputDiffersFromInput', () => {
  it('throws when input and output paths resolve to same file', () => {
    const filePath = path.join(sandboxDir, 'same.pdf');
    writeFileSync(filePath, 'content');
    expect(() => assertOutputDiffersFromInput('same.pdf', 'same.pdf', sandboxDir)).toThrow(
      FileError,
    );
  });

  it('allows different paths', () => {
    expect(() =>
      assertOutputDiffersFromInput('input.pdf', 'output.pdf', sandboxDir),
    ).not.toThrow();
  });
});
