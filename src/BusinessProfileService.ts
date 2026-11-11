import type { CloudApiClient } from './CloudApiClient.js';
import type { ApiResult, FileContents, JsonObject } from './types.js';

/**
 * Manages the WhatsApp business profile and resumable profile-picture uploads.
 *
 * Wraps the profile endpoints from the official "WhatsApp Cloud API"
 * Postman collection (Business Profiles).
 */
export class BusinessProfileService {
  /** All fields supported by the business profile endpoint. */
  static readonly PROFILE_FIELDS: readonly string[] = [
    'about',
    'address',
    'description',
    'email',
    'profile_picture_url',
    'websites',
    'vertical',
  ];

  constructor(readonly client: CloudApiClient) {}

  /** Get the business profile of the phone number. */
  async getBusinessProfile(
    phoneNumberId: string | null = null,
    fields: readonly string[] = BusinessProfileService.PROFILE_FIELDS,
  ): Promise<ApiResult> {
    const id = this.client.phoneNumberId(phoneNumberId);

    if (!id) {
      return this.client.unconfiguredResponse('get business profile');
    }

    return this.client.get(`${id}/whatsapp_business_profile`, { fields: fields.join(',') });
  }

  /**
   * Update the business profile of the phone number.
   *
   * @param profile Profile fields, e.g. `{ about: '...', websites: [...] }`.
   */
  async updateBusinessProfile(profile: JsonObject, phoneNumberId: string | null = null): Promise<ApiResult> {
    const id = this.client.phoneNumberId(phoneNumberId);

    if (!id) {
      return this.client.unconfiguredResponse('update business profile');
    }

    return this.client.post(`${id}/whatsapp_business_profile`, { messaging_product: 'whatsapp', ...profile });
  }

  /** Create a resumable upload session (used for profile pictures). */
  createUploadSession(appId: string, fileLength: number, fileType: string, fileName: string): Promise<ApiResult> {
    return this.client.post(`${appId}/uploads`, {
      file_length: fileLength,
      file_type: fileType,
      file_name: fileName,
    });
  }

  /**
   * Upload the raw file data to a resumable upload session.
   *
   * @param uploadId The upload session ID (e.g. "upload:...").
   * @param fileOffset Byte offset to resume from (0 for a fresh upload).
   */
  uploadFileData(uploadId: string, fileContents: FileContents, fileOffset = 0): Promise<ApiResult> {
    return this.client.postBinary(uploadId, fileContents, { file_offset: String(fileOffset) });
  }

  /** Query the status of a resumable upload session. */
  getUploadStatus(uploadId: string): Promise<ApiResult> {
    return this.client.get(uploadId);
  }
}
