import { compact, type CloudApiClient } from './CloudApiClient.js';
import type { ApiResult } from './types.js';

/**
 * Manages WhatsApp message QR codes (click-to-chat shortcuts).
 *
 * Wraps the /{Phone-Number-ID}/message_qrdls endpoints from the official
 * "WhatsApp Cloud API" Postman collection (QR codes).
 */
export class QrCodeService {
  constructor(readonly client: CloudApiClient) {}

  /**
   * List all QR codes, or a single one when `code` is given.
   *
   * @param fields e.g. ['code', 'prefilled_message', 'qr_image_url'].
   * @param format Image format applied to the qr_image_url field (PNG or SVG).
   */
  async getQrCodes(
    phoneNumberId: string | null = null,
    fields: string[] = [],
    code: string | null = null,
    format: string | null = null,
  ): Promise<ApiResult> {
    const id = this.client.phoneNumberId(phoneNumberId);

    if (!id) {
      return this.client.unconfiguredResponse('get QR codes');
    }

    if (format !== null) {
      fields = fields.map((field) => (field === 'qr_image_url' ? `qr_image_url.format(${format})` : field));
    }

    return this.client.get(`${id}/message_qrdls`, compact({
      fields: fields.length > 0 ? fields.join(',') : null,
      code,
    }));
  }

  /** Get a single QR code by its ID. */
  async getQrCode(qrCodeId: string, phoneNumberId: string | null = null): Promise<ApiResult> {
    const id = this.client.phoneNumberId(phoneNumberId);

    if (!id) {
      return this.client.unconfiguredResponse('get QR code');
    }

    return this.client.get(`${id}/message_qrdls/${qrCodeId}`);
  }

  /**
   * Create a QR code with a prefilled message.
   *
   * @param imageFormat PNG or SVG.
   */
  async createQrCode(prefilledMessage: string, imageFormat = 'PNG', phoneNumberId: string | null = null): Promise<ApiResult> {
    const id = this.client.phoneNumberId(phoneNumberId);

    if (!id) {
      return this.client.unconfiguredResponse('create QR code');
    }

    return this.client.post(`${id}/message_qrdls`, {
      prefilled_message: prefilledMessage,
      generate_qr_image: imageFormat,
    });
  }

  /** Update the prefilled message of an existing QR code. */
  async updateQrCode(code: string, prefilledMessage: string, phoneNumberId: string | null = null): Promise<ApiResult> {
    const id = this.client.phoneNumberId(phoneNumberId);

    if (!id) {
      return this.client.unconfiguredResponse('update QR code');
    }

    return this.client.post(`${id}/message_qrdls`, { code, prefilled_message: prefilledMessage });
  }

  /** Delete a QR code. */
  async deleteQrCode(qrCodeId: string, phoneNumberId: string | null = null): Promise<ApiResult> {
    const id = this.client.phoneNumberId(phoneNumberId);

    if (!id) {
      return this.client.unconfiguredResponse('delete QR code');
    }

    return this.client.delete(`${id}/message_qrdls/${qrCodeId}`);
  }
}
