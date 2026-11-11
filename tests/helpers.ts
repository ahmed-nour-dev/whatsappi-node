import { WhatsAppService, type FetchLike, type JsonObject, type WhatsAppConfig } from '../src/index.js';

export interface RecordedRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  /** Parsed JSON body, or {} when the request had none / was not JSON. */
  json: JsonObject;
  body: RequestInit['body'];
}

export interface FakeResponse {
  status?: number;
  body?: unknown;
}

/** A fetch stand-in that records every request and replays queued responses (the last one repeats). */
export function fakeFetch(...responses: Array<FakeResponse | Error>) {
  const requests: RecordedRequest[] = [];

  const fetch: FetchLike = async (url, init = {}) => {
    let json: JsonObject = {};

    if (typeof init.body === 'string') {
      try {
        json = JSON.parse(init.body);
      } catch {
        json = {};
      }
    }

    requests.push({
      url,
      method: init.method ?? 'GET',
      headers: (init.headers ?? {}) as Record<string, string>,
      json,
      body: init.body,
    });

    const next = responses[Math.min(requests.length, responses.length) - 1] ?? {};

    if (next instanceof Error) {
      throw next;
    }

    const body = typeof next.body === 'string' ? next.body : JSON.stringify(next.body ?? {});

    return new Response(body, { status: next.status ?? 200 });
  };

  return { fetch, requests };
}

export function makeService(fetch: FetchLike, overrides: WhatsAppConfig = {}): WhatsAppService {
  return new WhatsAppService({
    apiToken: 'test-token',
    phoneNumberId: '123456789',
    businessAccountId: '987654321',
    apiUrl: 'https://graph.facebook.com/v21.0',
    retryDelayMs: 0,
    fetch,
    ...overrides,
  });
}
