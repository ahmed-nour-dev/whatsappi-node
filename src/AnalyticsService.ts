import type { CloudApiClient } from './CloudApiClient.js';
import type { ApiResult } from './types.js';

/**
 * Retrieves messaging and conversation analytics for the WABA.
 *
 * Wraps the analytics fields from the official "WhatsApp Cloud API"
 * Postman collection (Analytics).
 */
export class AnalyticsService {
  constructor(readonly client: CloudApiClient) {}

  /**
   * Get messaging analytics (sent, delivered, read, cost) for a period.
   *
   * @param start Unix timestamp of the period start.
   * @param end Unix timestamp of the period end.
   * @param granularity HALF_HOUR, DAY or MONTH.
   * @param phoneNumbers Phone numbers to filter on (empty = all).
   * @param countryCodes Country codes to filter on (empty = all).
   */
  async getAnalytics(
    start: number,
    end: number,
    granularity = 'DAY',
    phoneNumbers: string[] = [],
    countryCodes: string[] = [],
    businessAccountId: string | null = null,
  ): Promise<ApiResult> {
    const accountId = this.client.businessAccountId(businessAccountId);

    if (!accountId) {
      return this.client.unconfiguredResponse('get analytics');
    }

    const fields =
      `analytics.start(${Math.trunc(start)}).end(${Math.trunc(end)}).granularity(${granularity})` +
      `.phone_numbers(${JSON.stringify(phoneNumbers)}).country_codes(${JSON.stringify(countryCodes)})`;

    return this.client.get(accountId, { fields });
  }

  /**
   * Get conversation analytics (volume and cost by type/direction/category).
   *
   * @param start Unix timestamp of the period start.
   * @param end Unix timestamp of the period end.
   * @param granularity DAILY, MONTHLY or HALF_HOUR.
   * @param conversationDirections e.g. ['business_initiated', 'user_initiated'].
   * @param dimensions e.g. ['conversation_type', 'conversation_direction'].
   * @param conversationTypes e.g. ['regular', 'free_entry_point', 'free_tier'].
   */
  async getConversationAnalytics(
    start: number,
    end: number,
    granularity = 'MONTHLY',
    conversationDirections: string[] = [],
    dimensions: string[] = ['conversation_type', 'conversation_direction'],
    conversationTypes: string[] = [],
    businessAccountId: string | null = null,
  ): Promise<ApiResult> {
    const accountId = this.client.businessAccountId(businessAccountId);

    if (!accountId) {
      return this.client.unconfiguredResponse('get conversation analytics');
    }

    const fields =
      `conversation_analytics.start(${Math.trunc(start)}).end(${Math.trunc(end)}).granularity(${granularity})` +
      `.conversation_directions(${JSON.stringify(conversationDirections)})` +
      `.conversation_types(${JSON.stringify(conversationTypes)})` +
      `.dimensions(${JSON.stringify(dimensions)})`;

    return this.client.get(accountId, { fields });
  }
}
