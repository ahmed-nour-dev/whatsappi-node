import { createHmac, timingSafeEqual } from 'node:crypto';
import { CloudApiClient } from './CloudApiClient.js';
import type { WhatsAppConfig } from './types.js';

/**
 * Verifies incoming Meta webhook requests: the one-time subscription
 * handshake (hub.mode/hub.verify_token/hub.challenge) and the
 * X-Hub-Signature-256 header on every subsequent event delivery.
 */
export class WebhookVerifier {
  private readonly client: CloudApiClient;

  /** Takes the same config as WhatsAppService (verifyToken / appSecret, or the env vars). */
  constructor(config: WhatsAppConfig | CloudApiClient = {}) {
    this.client = config instanceof CloudApiClient ? config : new CloudApiClient(config);
  }

  /**
   * Whether a webhook subscription (GET) request should be accepted.
   *
   * Meta sends hub.mode=subscribe with hub.verify_token; echo hub.challenge
   * back only once this returns true.
   */
  isValidSubscriptionRequest(mode: unknown, token: unknown, verifyToken?: string | null): boolean {
    const expected = verifyToken ?? this.client.verifyToken ?? '';

    return mode === 'subscribe' && expected !== '' && token === expected;
  }

  /**
   * Whether the X-Hub-Signature-256 header matches the HMAC-SHA256 of the
   * raw request body, keyed by the app secret.
   *
   * Meta computes the signature over the raw body, so pass it exactly as
   * received (before any JSON parsing). Fails closed: returns false when
   * no app secret is configured or the header is missing.
   */
  hasValidSignature(rawBody: string | Uint8Array, signatureHeader: unknown, appSecret?: string | null): boolean {
    const secret = appSecret ?? this.client.appSecret ?? '';

    if (secret === '' || typeof signatureHeader !== 'string' || signatureHeader === '') {
      return false;
    }

    const expected = Buffer.from(`sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`);
    const actual = Buffer.from(signatureHeader);

    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }
}
