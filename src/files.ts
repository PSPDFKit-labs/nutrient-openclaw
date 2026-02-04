/**
 * File I/O utilities: path resolution (with sandbox), file reading, response writing.
 *
 * Ported from:
 * - /tmp/nutrient-dws-mcp-server/src/fs/sandbox.ts  (path resolution)
 * - /tmp/nutrient-dws-mcp-server/src/dws/build.ts   (processFileReference, makeApiBuildCall)
 */

import fs from 'node:fs';
import path from 'node:path';
import { FileError } from './errors.js';
import type { FileReference } from './types.js';

/**
 * Resolve a file path for reading.
 *
 * When `sandboxDir` is set, paths are resolved relative to it and
 * traversal outside the sandbox is blocked (prevents `../../etc/passwd`).
 * When unset, paths resolve against CWD.
 */
export function resolveReadPath(filePath: string, sandboxDir?: string): string {
  if (sandboxDir) {
    const base = path.resolve(sandboxDir);
    const resolved = path.resolve(base, filePath);
    if (resolved !== base && !resolved.startsWith(base + path.sep)) {
      throw new FileError(`Path "${filePath}" escapes sandbox directory`);
    }
    return resolved;
  }
  return path.resolve(filePath);
}

/**
 * Resolve a file path for writing. Creates parent directories if needed.
 */
export function resolveWritePath(
  filePath: string,
  sandboxDir?: string,
): string {
  const resolved = resolveReadPath(filePath, sandboxDir);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  return resolved;
}

/**
 * Read a file from disk and return a `FileReference` suitable for FormData.
 *
 * If the path is an HTTP(S) URL, return a URL reference instead (the DWS API
 * can fetch remote files server-side).
 */
export function readFileReference(
  filePath: string,
  sandboxDir?: string,
): FileReference {
  // URL inputs are passed directly to the API (server-side fetch)
  if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
    return { key: filePath, url: filePath, name: filePath };
  }

  const resolvedPath = resolveReadPath(filePath, sandboxDir);

  if (!fs.existsSync(resolvedPath)) {
    throw new FileError(`File not found: ${filePath}`);
  }

  const stat = fs.statSync(resolvedPath);
  if (!stat.isFile()) {
    throw new FileError(`Not a file: ${filePath}`);
  }

  const fileBuffer = fs.readFileSync(resolvedPath);
  const fileName = path.basename(resolvedPath);
  // Sanitise the key to a safe FormData field name
  const fileKey = fileName.replace(/[^a-zA-Z0-9]/g, '_');

  return {
    key: fileKey,
    name: fileName,
    file: { buffer: fileBuffer, path: resolvedPath },
  };
}

/**
 * Write API response data (ArrayBuffer) to disk.
 * Returns the resolved absolute path of the written file.
 */
export function writeResponseToFile(
  data: ArrayBuffer,
  outputPath: string,
  sandboxDir?: string,
): string {
  const resolved = resolveWritePath(outputPath, sandboxDir);
  fs.writeFileSync(resolved, Buffer.from(data));
  return resolved;
}

/**
 * Build a FormData (or plain JSON object) from instructions and file references.
 *
 * When all inputs are URLs the DWS API accepts a JSON body directly, so we
 * skip FormData construction entirely for that case.
 */
export function buildFormData(
  instructions: Record<string, unknown>,
  fileRefs: Map<string, FileReference>,
): FormData | Record<string, unknown> {
  const allUrls = fileRefs.size > 0 && [...fileRefs.values()].every((ref) => ref.url);

  if (allUrls) {
    return instructions;
  }

  const formData = new FormData();
  formData.append('instructions', JSON.stringify(instructions));

  for (const [key, ref] of fileRefs.entries()) {
    if (ref.file) {
      const blob = new Blob([new Uint8Array(ref.file.buffer)]);
      formData.append(key, blob, ref.name);
    }
  }

  return formData;
}

/**
 * Guard: ensure the output path differs from the input path to prevent
 * overwriting a file that is still being read by the API.
 */
export function assertOutputDiffersFromInput(
  inputPath: string,
  outputPath: string,
  sandboxDir?: string,
): void {
  const resolvedInput = resolveReadPath(inputPath, sandboxDir);
  const resolvedOutput = resolveReadPath(outputPath, sandboxDir);
  if (path.resolve(resolvedInput) === path.resolve(resolvedOutput)) {
    throw new FileError(
      'Output path must be different from input path to prevent data corruption',
    );
  }
}
