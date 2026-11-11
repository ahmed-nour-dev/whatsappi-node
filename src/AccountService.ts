import type { CloudApiClient } from './CloudApiClient.js';
import type { ApiResult } from './types.js';

/**
 * Manages WhatsApp Business Accounts (WABAs), business portfolios and tokens.
 *
 * Wraps the account endpoints from the official "WhatsApp Cloud API"
 * Postman collection (Get Started, WABAs, Business Portfolio, Billing).
 */
export class AccountService {
  constructor(readonly client: CloudApiClient) {}

  /** Get the WhatsApp Business Account. */
  async getWaba(businessAccountId: string | null = null, fields: string[] = []): Promise<ApiResult> {
    const accountId = this.client.businessAccountId(businessAccountId);

    if (!accountId) {
      return this.client.unconfiguredResponse('get WABA');
    }

    return this.client.get(accountId, fields.length > 0 ? { fields: fields.join(',') } : {});
  }

  /** List WABAs owned by a business portfolio. */
  getOwnedWabas(businessId: string): Promise<ApiResult> {
    return this.client.get(`${businessId}/owned_whatsapp_business_accounts`);
  }

  /** List WABAs shared with (assigned to) a business portfolio. */
  getSharedWabas(businessId: string): Promise<ApiResult> {
    return this.client.get(`${businessId}/client_whatsapp_business_accounts`);
  }

  /** Subscribe the app to a WABA so webhook events are delivered. */
  async subscribeApp(businessAccountId: string | null = null): Promise<ApiResult> {
    const accountId = this.client.businessAccountId(businessAccountId);

    if (!accountId) {
      return this.client.unconfiguredResponse('subscribe app to WABA');
    }

    return this.client.post(`${accountId}/subscribed_apps`);
  }

  /** Get a business portfolio (Meta Business) with the requested fields. */
  getBusinessPortfolio(businessId: string, fields: string[] = ['id', 'name', 'timezone_id']): Promise<ApiResult> {
    return this.client.get(businessId, { fields: fields.join(',') });
  }

  /** Get credit lines attached to a business portfolio (billing). */
  getCreditLines(businessId: string): Promise<ApiResult> {
    return this.client.get(`${businessId}/extendedcredits`);
  }

  /** Inspect an access token (type, scopes, expiry) via the debug_token endpoint. */
  debugToken(inputToken: string | null = null): Promise<ApiResult> {
    return this.client.get('debug_token', { input_token: inputToken ?? this.client.apiToken });
  }
}
