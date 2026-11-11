import type {
  ApiResult,
  DownloadResult,
  FetchLike,
  FileContents,
  JsonObject,
  Logger,
  QueryParams,
  WhatsAppConfig,
} from './types.js';

const silentLogger: Logger = { info() {}, warn() {}, error() {} };

const env = (name: string): string | undefined => {
  const value = typeof process !== 'undefined' ? process.env?.[name] : undefined;
  return value === undefined || value === '' ? undefined : value;
};

/** Drop null/undefined entries so optional fields never reach the payload. */
export function compact<T extends Record<string, unknown>>(object: T): JsonObject {
  return Object.fromEntries(Object.entries(object).filter(([, value]) => value !== null && value !== undefined));
}

/** Encode a query object; nested arrays/objects use bracket notation. */
export function buildQuery(query: QueryParams): string {
  const params = new URLSearchParams();

  const add = (key: string, value: unknown): void => {
    if (value === null || value === undefined) return;
    if (Array.isArray(value)) value.forEach((item, index) => add(`${key}[${index}]`, item));
    else if (typeof value === 'object') Object.entries(value).forEach(([k, v]) => add(`${key}[${k}]`, v));
    else if (typeof value === 'boolean') params.append(key, value ? '1' : '0');
    else params.append(key, String(value));
  };

  Object.entries(query).forEach(([key, value]) => add(key, value));

  return params.toString();
}

interface RequestOptions {
  timeoutMs: number;
  /** Total attempts. Only idempotent reads use more than one. */
  attempts?: number;
}

/**
 * Low-level HTTP client for the WhatsApp Cloud API (Meta Graph API).
 *
 * Centralizes authentication, configuration resolution, endpoint building
 * and normalized success/error results for all WhatsApp domain services.
 */
export class CloudApiClient {
  static readonly DEFAULT_API_URL = 'https://graph.facebook.com/v21.0';

  readonly logger: Logger;

  private readonly config: WhatsAppConfig;

  /**
   * Explicit options win; anything left out falls back to the WHATSAPP_*
   * environment variables, read at call time.
   */
  constructor(config: WhatsAppConfig = {}) {
    this.config = config;
    this.logger = config.logger ?? silentLogger;
  }

  get apiToken(): string | null {
    return this.config.apiToken || env('WHATSAPP_API_TOKEN') || null;
  }

  get verifyToken(): string | null {
    return this.config.verifyToken || env('WHATSAPP_VERIFY_TOKEN') || null;
  }

  get appSecret(): string | null {
    return this.config.appSecret || env('WHATSAPP_APP_SECRET') || null;
  }

  /** Whether the API token required for authenticated calls is configured. */
  isConfigured(): boolean {
    return this.apiToken !== null;
  }

  /** Build an absolute Graph API URL for the given path. */
  url(path: string): string {
    const base = (this.config.apiUrl || env('WHATSAPP_API_URL') || CloudApiClient.DEFAULT_API_URL).replace(/\/+$/, '');

    return `${base}/${path.replace(/^\/+/, '')}`;
  }

  /** Resolve the business phone number ID. An explicit override wins over config. */
  phoneNumberId(phoneNumberId?: string | null): string | null {
    const id = phoneNumberId || this.config.phoneNumberId || env('WHATSAPP_PHONE_NUMBER_ID');

    return id ? String(id) : null;
  }

  /** Resolve the WhatsApp Business Account ID. An explicit override wins over config. */
  businessAccountId(businessAccountId?: string | null): string | null {
    const id = businessAccountId || this.config.businessAccountId || env('WHATSAPP_BUSINESS_ACCOUNT_ID');

    return id ? String(id) : null;
  }

  /** Perform an authenticated GET request. Retried once on transient failures. */
  get(path: string, query: QueryParams = {}): Promise<ApiResult> {
    return this.sendRequest(this.withQuery(this.url(path), query), { method: 'GET' }, { timeoutMs: 15_000, attempts: 2 });
  }

  /**
   * Perform an authenticated POST request with a JSON payload.
   *
   * POSTs are intentionally not retried: a timed-out request may have
   * succeeded server-side, and retrying could send duplicate messages
   * or create duplicate resources.
   */
  post(path: string, payload: JsonObject = {}): Promise<ApiResult> {
    return this.sendRequest(this.url(path), this.jsonInit('POST', payload), { timeoutMs: 15_000 });
  }

  /** Perform an authenticated PUT request with a JSON payload. */
  put(path: string, payload: JsonObject = {}): Promise<ApiResult> {
    return this.sendRequest(this.url(path), this.jsonInit('PUT', payload), { timeoutMs: 15_000 });
  }

  /**
   * Perform an authenticated DELETE request.
   *
   * Meta expects filters (name, hsm_id, phone_number_id, ...) as query
   * parameters, while some endpoints (e.g. unblock users) require a JSON
   * body instead, so both are supported explicitly. When a body is given
   * the query is ignored.
   */
  delete(path: string, query: QueryParams = {}, body: JsonObject = {}): Promise<ApiResult> {
    const hasBody = Object.keys(body).length > 0;
    const url = hasBody ? this.url(path) : this.withQuery(this.url(path), query);

    return this.sendRequest(url, this.jsonInit('DELETE', body), { timeoutMs: 15_000 });
  }

  /** Upload a file to the API using multipart/form-data (e.g. media uploads). */
  postMultipart(
    path: string,
    fileContents: FileContents,
    fileName: string,
    mimeType: string,
    fields: Record<string, string> = {},
  ): Promise<ApiResult> {
    const form = new FormData();

    Object.entries(fields).forEach(([key, value]) => form.append(key, String(value)));
    form.append('file', new Blob([fileContents] as ConstructorParameters<typeof Blob>[0], { type: mimeType }), fileName);

    return this.sendRequest(this.url(path), { method: 'POST', body: form }, { timeoutMs: 30_000 });
  }

  /** Send raw binary data to the API (e.g. resumable upload file data). */
  postBinary(path: string, contents: FileContents, headers: Record<string, string> = {}): Promise<ApiResult> {
    return this.sendRequest(
      this.url(path),
      {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/octet-stream' },
        body: contents as RequestInit['body'],
      },
      { timeoutMs: 30_000 },
    );
  }

  /** Download raw file contents from an absolute media URL. */
  async download(url: string): Promise<DownloadResult> {
    let response: Response;

    try {
      response = await this.request(url, { method: 'GET' }, { timeoutMs: 30_000, attempts: 2 });
    } catch (error) {
      return { success: false, contents: null, error: this.connectionError(error), status: 0 };
    }

    if (response.ok) {
      return {
        success: true,
        contents: Buffer.from(await response.arrayBuffer()),
        error: null,
        status: response.status,
      };
    }

    return {
      success: false,
      contents: null,
      error: this.extractError(await this.parseJson(response), response.status),
      status: response.status,
    };
  }

  /** Standard result for calls made while the integration is not configured. */
  unconfiguredResponse(action: string): ApiResult {
    this.logger.error(`[WhatsApp] Cannot ${action}: WhatsApp API is not configured.`);

    return { success: false, data: {}, error: 'WhatsApp API is not configured.', status: 0 };
  }

  private withQuery(url: string, query: QueryParams): string {
    const queryString = buildQuery(query);

    return queryString === '' ? url : `${url}?${queryString}`;
  }

  private jsonInit(method: string, payload: JsonObject): RequestInit {
    if (Object.keys(payload).length === 0) {
      return { method };
    }

    return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) };
  }

  /**
   * Execute an HTTP request and normalize the outcome, so callers always
   * receive the documented result shape and never have to catch.
   */
  private async sendRequest(url: string, init: RequestInit, options: RequestOptions): Promise<ApiResult> {
    try {
      const response = await this.request(url, init, options);
      const json = await this.parseJson(response);
      const data = json !== null && typeof json === 'object' ? (json as JsonObject) : {};

      if (response.ok) {
        return { success: true, data, error: null, status: response.status };
      }

      return { success: false, data, error: this.extractError(json, response.status), status: response.status };
    } catch (error) {
      return { success: false, data: {}, error: this.connectionError(error), status: 0 };
    }
  }

  /** Authenticated fetch with a timeout; retries network errors, 429 and 5xx when attempts > 1. */
  private async request(url: string, init: RequestInit, { timeoutMs, attempts = 1 }: RequestOptions): Promise<Response> {
    const fetchImpl: FetchLike = this.config.fetch ?? ((input, options) => globalThis.fetch(input, options));
    const headers = {
      Accept: 'application/json',
      ...(init.headers as Record<string, string> | undefined),
      Authorization: `Bearer ${this.apiToken ?? ''}`,
    };

    for (let attempt = 1; ; attempt++) {
      const isLastAttempt = attempt >= attempts;

      try {
        const response = await fetchImpl(url, { ...init, headers, signal: AbortSignal.timeout(timeoutMs) });

        if (isLastAttempt || (response.status !== 429 && response.status < 500)) {
          return response;
        }
      } catch (error) {
        if (isLastAttempt) throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, this.config.retryDelayMs ?? 500));
    }
  }

  private async parseJson(response: Response): Promise<unknown> {
    try {
      return JSON.parse(await response.text());
    } catch {
      return null;
    }
  }

  private connectionError(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error);
    const cause = error instanceof Error && error.cause instanceof Error ? ` (${error.cause.message})` : '';

    return `Connection to the WhatsApp API failed: ${message}${cause}`;
  }

  /**
   * Extract a descriptive error message from a failed Meta response.
   *
   * Combines Meta's primary message with any user-facing explanation
   * (error_user_title / error_user_msg), error_data details, subcode and
   * trace ID so failures can be diagnosed without re-running the request.
   * The full error payload is logged for debugging.
   */
  private extractError(json: unknown, status: number): string {
    const body = json !== null && typeof json === 'object' ? (json as JsonObject) : {};
    const error = body.error;

    if (error === null || typeof error !== 'object') {
      return String(body.error_user_msg ?? 'Unknown error');
    }

    this.logger.warn('[WhatsApp] API request failed.', { status, error });

    const parts = [
      error.message,
      error.error_user_title,
      error.error_user_msg,
      error.error_data?.details,
      error.error_subcode != null ? `Subcode: ${error.error_subcode}` : null,
      error.fbtrace_id != null ? `Trace ID: ${error.fbtrace_id}` : null,
    ].filter(Boolean);

    return parts.length > 0 ? [...new Set(parts)].join(' | ') : 'Unknown error';
  }
}
