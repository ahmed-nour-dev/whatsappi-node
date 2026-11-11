/**
 * Shared types: configuration, logger and the normalized result shapes
 * returned by every call.
 */

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface Logger {
  info(message: string, context?: unknown): void;
  warn(message: string, context?: unknown): void;
  error(message: string, context?: unknown): void;
}

export interface WhatsAppConfig {
  /** Default business phone number ID. Env: WHATSAPP_PHONE_NUMBER_ID */
  phoneNumberId?: string | null;
  /** WhatsApp Business Account ID (WABA). Env: WHATSAPP_BUSINESS_ACCOUNT_ID */
  businessAccountId?: string | null;
  /** System user (recommended) or temporary access token. Env: WHATSAPP_API_TOKEN */
  apiToken?: string | null;
  /** Token you registered with Meta for the webhook handshake. Env: WHATSAPP_VERIFY_TOKEN */
  verifyToken?: string | null;
  /** Meta app secret, used to check X-Hub-Signature-256. Env: WHATSAPP_APP_SECRET */
  appSecret?: string | null;
  /** Graph API base URL including version. Env: WHATSAPP_API_URL */
  apiUrl?: string | null;
  /** Where log lines go. Silent by default; pass `console` to see them. */
  logger?: Logger | null;
  /** Custom fetch implementation (tests, proxies). Defaults to the global fetch. */
  fetch?: FetchLike | null;
  /** Pause between the two attempts of a retried GET, in milliseconds. Default 500. */
  retryDelayMs?: number;
}

/** A JSON object as returned by the Graph API. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type JsonObject = Record<string, any>;

/** Standard result of most calls. `status` is 0 when no HTTP response was received. */
export interface ApiResult<T = JsonObject> {
  success: boolean;
  data: T;
  error: string | null;
  status: number;
}

/** Result of every send-message call. */
export interface SendResult {
  success: boolean;
  message_id: string | null;
  error: string | null;
}

/** Result of a media upload. */
export interface UploadResult {
  success: boolean;
  media_id: string | null;
  error: string | null;
}

/** Result of a media download. */
export interface DownloadResult {
  success: boolean;
  contents: Buffer | null;
  error: string | null;
  status: number;
}

/** Result of a template status check. */
export interface TemplateStatusResult {
  success: boolean;
  status: string | null;
  category: string | null;
  error: string | null;
}

/** Raw file contents accepted by upload calls. */
export type FileContents = string | Uint8Array | ArrayBuffer | Blob;

export type QueryParams = Record<string, unknown>;
