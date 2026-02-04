/**
 * Shared HTTP client for the Nutrient DWS API.
 *
 * Ported from: /tmp/nutrient-dws-mcp-server/src/dws/api.ts
 * Changes: native fetch instead of axios, ArrayBuffer instead of streams,
 * credit headers returned in response object instead of logged separately.
 */

import { NutrientApiError } from './errors.js';
import type { NutrientClient, NutrientResponse } from './types.js';

const API_BASE = 'https://api.nutrient.io';
const CREDIT_USAGE_HEADER = 'x-pspdfkit-credit-usage';
const REMAINING_CREDITS_HEADER = 'x-pspdfkit-remaining-credits';

/**
 * Create an HTTP client bound to a specific API key.
 *
 * Every request includes:
 * - `Authorization: Bearer <apiKey>`
 * - `User-Agent: NutrientOpenClawPlugin/0.1.0`
 *
 * Credit headers (`x-pspdfkit-credit-usage`, `x-pspdfkit-remaining-credits`)
 * are extracted from every response and returned in the `NutrientResponse`.
 */
export function makeClient(apiKey: string): NutrientClient {
  return {
    async post(
      endpoint: string,
      body: FormData | object,
      opts: { timeout?: number } = {},
    ): Promise<NutrientResponse> {
      const url = `${API_BASE}/${endpoint}`;
      const headers: Record<string, string> = {
        Authorization: `Bearer ${apiKey}`,
        'User-Agent': 'NutrientOpenClawPlugin/0.1.0',
      };

      const isFormData = body instanceof FormData;
      const fetchBody = isFormData ? body : JSON.stringify(body);
      if (!isFormData) {
        headers['Content-Type'] = 'application/json';
      }

      const controller = new AbortController();
      const timeoutId = opts.timeout
        ? setTimeout(() => controller.abort(), opts.timeout)
        : undefined;

      try {
        const res = await fetch(url, {
          method: 'POST',
          headers,
          body: fetchBody as BodyInit,
          signal: controller.signal,
        });

        // Extract credit headers
        const creditsUsed =
          parseFloat(res.headers.get(CREDIT_USAGE_HEADER) ?? '') || null;
        const creditsRemaining =
          parseFloat(res.headers.get(REMAINING_CREDITS_HEADER) ?? '') || null;

        // Collect response headers into a plain object
        const responseHeaders: Record<string, string> = {};
        res.headers.forEach((value, key) => {
          responseHeaders[key] = value;
        });

        // Parse body: JSON responses as string, everything else as ArrayBuffer
        const contentType = res.headers.get('content-type') ?? '';
        let data: ArrayBuffer | string;

        if (contentType.includes('json')) {
          data = await res.text();
        } else {
          data = await res.arrayBuffer();
        }

        // Non-2xx → throw NutrientApiError with parsed details
        if (!res.ok) {
          let errorMessage = `HTTP ${res.status}`;
          let details: unknown;

          if (typeof data === 'string') {
            try {
              const errorJson = JSON.parse(data) as Record<string, unknown>;
              errorMessage =
                (errorJson.details as string) ??
                (errorJson.message as string) ??
                errorMessage;
              details = errorJson;
            } catch {
              errorMessage = data || errorMessage;
            }
          }

          throw new NutrientApiError(
            res.status,
            errorMessage,
            creditsUsed ?? undefined,
            details,
          );
        }

        return {
          ok: true,
          status: res.status,
          data,
          headers: responseHeaders,
          creditsUsed,
          creditsRemaining,
        };
      } catch (e) {
        if (e instanceof NutrientApiError) throw e;
        if (
          e instanceof DOMException &&
          e.name === 'AbortError'
        ) {
          throw new NutrientApiError(
            0,
            `Request timed out after ${opts.timeout}ms`,
          );
        }
        throw e;
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
      }
    },
  };
}
