import type { CloudApiClient } from './CloudApiClient.js';
import type { ApiResult, QueryParams } from './types.js';

/**
 * Manages business phone numbers: discovery, registration and verification.
 *
 * Wraps the phone number endpoints from the official "WhatsApp Cloud API"
 * Postman collection (Phone Numbers, Registration, OnPrem Account Migration).
 */
export class PhoneNumberService {
  constructor(readonly client: CloudApiClient) {}

  /**
   * List all phone numbers on the WhatsApp Business Account.
   *
   * @param query Optional filters (fields, filtering, ...).
   */
  async getPhoneNumbers(businessAccountId: string | null = null, query: QueryParams = {}): Promise<ApiResult> {
    const accountId = this.client.businessAccountId(businessAccountId);

    if (!accountId) {
      return this.client.unconfiguredResponse('get phone numbers');
    }

    return this.client.get(`${accountId}/phone_numbers`, query);
  }

  /** Get a single phone number by ID. */
  async getPhoneNumber(phoneNumberId: string | null = null, fields: string[] = []): Promise<ApiResult> {
    const id = this.client.phoneNumberId(phoneNumberId);

    if (!id) {
      return this.client.unconfiguredResponse('get phone number');
    }

    return this.client.get(id, fields.length > 0 ? { fields: fields.join(',') } : {});
  }

  /** Get the display name approval status of a phone number. */
  getDisplayNameStatus(phoneNumberId: string | null = null): Promise<ApiResult> {
    return this.getPhoneNumber(phoneNumberId, ['name_status']);
  }

  /**
   * Register a phone number with the Cloud API, setting the two-step
   * verification PIN in the same call. Also used when migrating an
   * account from the On-Premises API.
   */
  async registerPhone(pin: string, phoneNumberId: string | null = null): Promise<ApiResult> {
    const id = this.client.phoneNumberId(phoneNumberId);

    if (!id) {
      return this.client.unconfiguredResponse('register phone');
    }

    return this.client.post(`${id}/register`, { messaging_product: 'whatsapp', pin });
  }

  /** Deregister a phone number from the Cloud API. */
  async deregisterPhone(phoneNumberId: string | null = null): Promise<ApiResult> {
    const id = this.client.phoneNumberId(phoneNumberId);

    if (!id) {
      return this.client.unconfiguredResponse('deregister phone');
    }

    return this.client.post(`${id}/deregister`);
  }

  /**
   * Request a verification code (SMS or voice call) to prove phone ownership.
   *
   * @param codeMethod SMS or VOICE.
   */
  async requestVerificationCode(codeMethod = 'SMS', language = 'en_US', phoneNumberId: string | null = null): Promise<ApiResult> {
    const id = this.client.phoneNumberId(phoneNumberId);

    if (!id) {
      return this.client.unconfiguredResponse('request verification code');
    }

    return this.client.post(`${id}/request_code`, { code_method: codeMethod, language });
  }

  /** Verify a phone number with the code received via SMS/voice. */
  async verifyCode(code: string, phoneNumberId: string | null = null): Promise<ApiResult> {
    const id = this.client.phoneNumberId(phoneNumberId);

    if (!id) {
      return this.client.unconfiguredResponse('verify code');
    }

    return this.client.post(`${id}/verify_code`, { code });
  }

  /** Set or change the two-step verification PIN of a registered phone number. */
  async setTwoStepVerification(pin: string, phoneNumberId: string | null = null): Promise<ApiResult> {
    const id = this.client.phoneNumberId(phoneNumberId);

    if (!id) {
      return this.client.unconfiguredResponse('set two-step verification');
    }

    return this.client.post(id, { pin });
  }
}
