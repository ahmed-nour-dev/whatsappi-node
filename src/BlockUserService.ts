import type { CloudApiClient } from './CloudApiClient.js';
import type { ApiResult, JsonObject } from './types.js';

/**
 * Manages blocked WhatsApp users for the business phone number.
 *
 * Wraps the /{Phone-Number-ID}/block_users endpoints from the official
 * "WhatsApp Cloud API" Postman collection (Block Users).
 */
export class BlockUserService {
  constructor(readonly client: CloudApiClient) {}

  /** List users blocked by the business phone number. */
  async getBlockedUsers(phoneNumberId: string | null = null): Promise<ApiResult> {
    const id = this.client.phoneNumberId(phoneNumberId);

    if (!id) {
      return this.client.unconfiguredResponse('get blocked users');
    }

    return this.client.get(`${id}/block_users`);
  }

  /**
   * Block one or more users by their phone numbers.
   *
   * @param users Phone numbers in international format.
   */
  async blockUsers(users: string[], phoneNumberId: string | null = null): Promise<ApiResult> {
    const id = this.client.phoneNumberId(phoneNumberId);

    if (!id) {
      return this.client.unconfiguredResponse('block users');
    }

    return this.client.post(`${id}/block_users`, this.payload(users));
  }

  /**
   * Unblock one or more users by their phone numbers.
   *
   * @param users Phone numbers in international format.
   */
  async unblockUsers(users: string[], phoneNumberId: string | null = null): Promise<ApiResult> {
    const id = this.client.phoneNumberId(phoneNumberId);

    if (!id) {
      return this.client.unconfiguredResponse('unblock users');
    }

    return this.client.delete(`${id}/block_users`, {}, this.payload(users));
  }

  private payload(users: string[]): JsonObject {
    return {
      messaging_product: 'whatsapp',
      block_users: users.map((user) => ({ user })),
    };
  }
}
