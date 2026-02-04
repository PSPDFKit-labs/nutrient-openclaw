import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { makeClient } from '../src/client.js';
import { NutrientApiError } from '../src/errors.js';

describe('makeClient', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    // Reset fetch mock before each test
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function mockFetch(
    body: ArrayBuffer | string = new ArrayBuffer(10),
    status = 200,
    headers: Record<string, string> = {},
  ) {
    const headersObj = new Headers({
      'x-pspdfkit-credit-usage': '1',
      'x-pspdfkit-remaining-credits': '999',
      ...headers,
    });

    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      headers: headersObj,
      text: async () => (typeof body === 'string' ? body : ''),
      arrayBuffer: async () => (body instanceof ArrayBuffer ? body : new ArrayBuffer(0)),
    } as Response);
  }

  it('sends Authorization header with Bearer token', async () => {
    mockFetch();
    const client = makeClient('test-key-123');
    await client.post('build', { instructions: {} });

    const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[0]).toBe('https://api.nutrient.io/build');
    expect(call[1].headers.Authorization).toBe('Bearer test-key-123');
  });

  it('sends User-Agent header', async () => {
    mockFetch();
    const client = makeClient('key');
    await client.post('build', {});

    const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[1].headers['User-Agent']).toBe('NutrientOpenClawPlugin/0.1.0');
  });

  it('sends Content-Type: application/json for object bodies', async () => {
    mockFetch();
    const client = makeClient('key');
    await client.post('build', { foo: 'bar' });

    const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[1].headers['Content-Type']).toBe('application/json');
  });

  it('does not set Content-Type for FormData bodies', async () => {
    mockFetch();
    const client = makeClient('key');
    const fd = new FormData();
    fd.append('test', 'value');
    await client.post('build', fd);

    const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[1].headers['Content-Type']).toBeUndefined();
  });

  it('extracts credit headers from response', async () => {
    mockFetch(new ArrayBuffer(10), 200, {
      'x-pspdfkit-credit-usage': '5',
      'x-pspdfkit-remaining-credits': '100',
    });
    const client = makeClient('key');
    const res = await client.post('build', {});

    expect(res.creditsUsed).toBe(5);
    expect(res.creditsRemaining).toBe(100);
  });

  it('returns ArrayBuffer for binary responses', async () => {
    const buf = new ArrayBuffer(42);
    mockFetch(buf, 200, { 'content-type': 'application/pdf' });
    const client = makeClient('key');
    const res = await client.post('build', {});

    expect(res.data).toBeInstanceOf(ArrayBuffer);
  });

  it('returns string for JSON responses', async () => {
    mockFetch('{"result":"ok"}', 200, { 'content-type': 'application/json' });

    const headersObj = new Headers({
      'content-type': 'application/json',
      'x-pspdfkit-credit-usage': '1',
      'x-pspdfkit-remaining-credits': '999',
    });

    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      headers: headersObj,
      text: async () => '{"result":"ok"}',
      arrayBuffer: async () => new ArrayBuffer(0),
    } as Response);

    const client = makeClient('key');
    const res = await client.post('build', {});

    expect(typeof res.data).toBe('string');
    expect(res.data).toContain('result');
  });

  it('throws NutrientApiError on 401 response', async () => {
    const headersObj = new Headers({
      'content-type': 'application/json',
      'x-pspdfkit-credit-usage': '0',
    });

    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 401,
      headers: headersObj,
      text: async () => '{"message":"Unauthorized"}',
      arrayBuffer: async () => new ArrayBuffer(0),
    } as Response);

    const client = makeClient('bad-key');
    await expect(client.post('build', {})).rejects.toThrow(NutrientApiError);
  });

  it('throws NutrientApiError on 402 response', async () => {
    const headersObj = new Headers({
      'content-type': 'application/json',
    });

    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 402,
      headers: headersObj,
      text: async () => '{"message":"Insufficient credits"}',
      arrayBuffer: async () => new ArrayBuffer(0),
    } as Response);

    const client = makeClient('key');
    await expect(client.post('build', {})).rejects.toThrow(NutrientApiError);
  });

  it('throws NutrientApiError on 500 response', async () => {
    const headersObj = new Headers({
      'content-type': 'application/json',
    });

    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 500,
      headers: headersObj,
      text: async () => '{"message":"Internal Server Error"}',
      arrayBuffer: async () => new ArrayBuffer(0),
    } as Response);

    const client = makeClient('key');
    const err = await client.post('build', {}).catch((e) => e);
    expect(err).toBeInstanceOf(NutrientApiError);
    expect(err.status).toBe(500);
  });

  it('throws NutrientApiError on timeout', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockImplementation(
      async (_url: string, init: RequestInit) => {
        // Simulate abort
        const err = new DOMException('The operation was aborted', 'AbortError');
        throw err;
      },
    );

    const client = makeClient('key');
    const err = await client.post('build', {}, { timeout: 1 }).catch((e) => e);
    expect(err).toBeInstanceOf(NutrientApiError);
    expect(err.message).toContain('timed out');
  });

  it('parses error JSON from response body', async () => {
    const headersObj = new Headers({
      'content-type': 'application/json',
    });

    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 422,
      headers: headersObj,
      text: async () => '{"details":"Invalid page range"}',
      arrayBuffer: async () => new ArrayBuffer(0),
    } as Response);

    const client = makeClient('key');
    const err = await client.post('build', {}).catch((e) => e);
    expect(err).toBeInstanceOf(NutrientApiError);
    expect(err.message).toBe('Invalid page range');
  });
});
