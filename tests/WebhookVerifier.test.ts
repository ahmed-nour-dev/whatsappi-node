import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { WebhookVerifier } from '../src/index.js';

const sign = (body: string, secret: string) => `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;

describe('WebhookVerifier', () => {
  const verifier = new WebhookVerifier({ verifyToken: null, appSecret: null });
  const body = '{"object":"whatsapp_business_account"}';

  it('accepts a subscription request when mode and token match', () => {
    expect(verifier.isValidSubscriptionRequest('subscribe', 'secret', 'secret')).toBe(true);
  });

  it('rejects a subscription request on token mismatch', () => {
    expect(verifier.isValidSubscriptionRequest('subscribe', 'wrong', 'secret')).toBe(false);
  });

  it('rejects a subscription request when mode is not subscribe', () => {
    expect(verifier.isValidSubscriptionRequest('unsubscribe', 'secret', 'secret')).toBe(false);
  });

  it('rejects a subscription request when no verify token is configured', () => {
    expect(verifier.isValidSubscriptionRequest('subscribe', 'secret', '')).toBe(false);
    expect(verifier.isValidSubscriptionRequest('subscribe', undefined)).toBe(false);
  });

  it('accepts a matching HMAC signature', () => {
    expect(verifier.hasValidSignature(body, sign(body, 'app-secret'), 'app-secret')).toBe(true);
    expect(verifier.hasValidSignature(Buffer.from(body), sign(body, 'app-secret'), 'app-secret')).toBe(true);
  });

  it('rejects a tampered body', () => {
    expect(verifier.hasValidSignature('tampered', sign('original', 'app-secret'), 'app-secret')).toBe(false);
  });

  it('fails closed when no app secret is configured', () => {
    expect(verifier.hasValidSignature(body, sign(body, 'app-secret'), '')).toBe(false);
    expect(verifier.hasValidSignature(body, sign(body, 'app-secret'))).toBe(false);
  });

  it('rejects a missing or malformed header', () => {
    expect(verifier.hasValidSignature('{}', null, 'app-secret')).toBe(false);
    expect(verifier.hasValidSignature('{}', undefined, 'app-secret')).toBe(false);
    expect(verifier.hasValidSignature('{}', 'sha256=short', 'app-secret')).toBe(false);
  });

  it('reads the verify token and app secret from config', () => {
    const configured = new WebhookVerifier({ verifyToken: 'cfg-token', appSecret: 'cfg-secret' });

    expect(configured.isValidSubscriptionRequest('subscribe', 'cfg-token')).toBe(true);
    expect(configured.hasValidSignature(body, sign(body, 'cfg-secret'))).toBe(true);
  });
});
