import type { CloudApiClient } from './CloudApiClient.js';
import type { ApiResult } from './types.js';

/**
 * Manages WhatsApp commerce settings (cart and catalog visibility).
 *
 * Wraps the /{Phone-Number-ID}/whatsapp_commerce_settings endpoints from
 * the official "WhatsApp Cloud API" Postman collection (Commerce Settings).
 */
export class CommerceService {
  constructor(readonly client: CloudApiClient) {}

  /** Get the commerce settings of the phone number. */
  async getCommerceSettings(phoneNumberId: string | null = null): Promise<ApiResult> {
    const id = this.client.phoneNumberId(phoneNumberId);

    if (!id) {
      return this.client.unconfiguredResponse('get commerce settings');
    }

    return this.client.get(`${id}/whatsapp_commerce_settings`);
  }

  /** Enable or disable the shopping cart and catalog visibility. */
  async updateCommerceSettings(
    isCartEnabled: boolean,
    isCatalogVisible: boolean,
    phoneNumberId: string | null = null,
  ): Promise<ApiResult> {
    const id = this.client.phoneNumberId(phoneNumberId);

    if (!id) {
      return this.client.unconfiguredResponse('update commerce settings');
    }

    return this.client.post(`${id}/whatsapp_commerce_settings`, {
      is_cart_enabled: isCartEnabled,
      is_catalog_visible: isCatalogVisible,
    });
  }
}
