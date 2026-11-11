import type { CloudApiClient } from './CloudApiClient.js';
import type { ApiResult, DownloadResult, FileContents, QueryParams, UploadResult } from './types.js';

/**
 * Manages media assets (images, audio, documents, stickers, videos).
 *
 * Wraps the /{Phone-Number-ID}/media and /{Media-ID} endpoints from the
 * official "WhatsApp Cloud API" Postman collection (Media).
 */
export class MediaService {
  constructor(readonly client: CloudApiClient) {}

  /**
   * Upload media to Meta and get its media ID for use in messages.
   *
   * @param fileContents Raw contents of the file (Buffer, Uint8Array, Blob or string).
   */
  async uploadMedia(
    fileContents: FileContents,
    mimeType: string,
    fileName = 'file',
    phoneNumberId: string | null = null,
  ): Promise<UploadResult> {
    const id = this.client.phoneNumberId(phoneNumberId);

    if (!id) {
      this.client.unconfiguredResponse('upload media');

      return { success: false, media_id: null, error: 'WhatsApp API is not configured.' };
    }

    const result = await this.client.postMultipart(`${id}/media`, fileContents, fileName, mimeType, {
      messaging_product: 'whatsapp',
      type: mimeType,
    });

    if (result.success) {
      const mediaId: string | null = result.data.id ?? null;
      this.client.logger.info('[WhatsApp] Media uploaded.', { media_id: mediaId, mime_type: mimeType });

      return { success: true, media_id: mediaId, error: null };
    }

    this.client.logger.error('[WhatsApp] Failed to upload media.', {
      mime_type: mimeType,
      status: result.status,
      error: result.error,
    });

    return { success: false, media_id: null, error: result.error };
  }

  /** Retrieve the temporary download URL for a media ID (valid for 5 minutes). */
  getMediaUrl(mediaId: string, phoneNumberId: string | null = null): Promise<ApiResult> {
    return this.client.get(mediaId, this.phoneNumberQuery(phoneNumberId));
  }

  /** Download media binary contents from a URL returned by getMediaUrl(). */
  downloadMedia(mediaUrl: string): Promise<DownloadResult> {
    return this.client.download(mediaUrl);
  }

  /** Delete previously uploaded media. */
  deleteMedia(mediaId: string, phoneNumberId: string | null = null): Promise<ApiResult> {
    return this.client.delete(mediaId, this.phoneNumberQuery(phoneNumberId));
  }

  private phoneNumberQuery(phoneNumberId: string | null): QueryParams {
    const id = this.client.phoneNumberId(phoneNumberId);

    return id ? { phone_number_id: id } : {};
  }
}
