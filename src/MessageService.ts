import { compact, type CloudApiClient } from './CloudApiClient.js';
import type { ApiResult, JsonObject, SendResult } from './types.js';

export interface ReplyButton {
  id: string;
  title: string;
}

/**
 * Sends all WhatsApp Cloud API message types and manages read receipts.
 *
 * Wraps the /{Phone-Number-ID}/messages endpoints from the official
 * "WhatsApp Cloud API" Postman collection (Messages, Typing indicators).
 */
export class MessageService {
  constructor(readonly client: CloudApiClient) {}

  /** Send a text message, optionally replying to a previous message. */
  sendTextMessage(to: string, body: string, previewUrl = false, replyToMessageId: string | null = null): Promise<SendResult> {
    return this.send(to, compact({
      type: 'text',
      text: { body, preview_url: previewUrl },
      context: this.replyContext(replyToMessageId),
    }));
  }

  /** React to a received message with an emoji. Pass an empty emoji to remove a reaction. */
  sendReactionMessage(to: string, messageId: string, emoji: string): Promise<SendResult> {
    return this.send(to, { type: 'reaction', reaction: { message_id: messageId, emoji } });
  }

  /** Send an image uploaded to Meta (by media ID). */
  sendImageMessage(to: string, mediaId: string, caption: string | null = null, replyToMessageId: string | null = null): Promise<SendResult> {
    return this.sendMediaMessage(to, 'image', mediaId, false, { caption }, replyToMessageId);
  }

  /** Send an image hosted on a public URL. */
  sendImageMessageByUrl(to: string, url: string, caption: string | null = null, replyToMessageId: string | null = null): Promise<SendResult> {
    return this.sendMediaMessage(to, 'image', url, true, { caption }, replyToMessageId);
  }

  /** Send an audio clip uploaded to Meta (by media ID). */
  sendAudioMessage(to: string, mediaId: string, replyToMessageId: string | null = null): Promise<SendResult> {
    return this.sendMediaMessage(to, 'audio', mediaId, false, {}, replyToMessageId);
  }

  /** Send an audio clip hosted on a public URL. */
  sendAudioMessageByUrl(to: string, url: string, replyToMessageId: string | null = null): Promise<SendResult> {
    return this.sendMediaMessage(to, 'audio', url, true, {}, replyToMessageId);
  }

  /** Send a document uploaded to Meta (by media ID). */
  sendDocumentMessage(
    to: string,
    mediaId: string,
    caption: string | null = null,
    fileName: string | null = null,
    replyToMessageId: string | null = null,
  ): Promise<SendResult> {
    return this.sendMediaMessage(to, 'document', mediaId, false, { caption, filename: fileName }, replyToMessageId);
  }

  /** Send a document hosted on a public URL. */
  sendDocumentMessageByUrl(
    to: string,
    url: string,
    caption: string | null = null,
    fileName: string | null = null,
    replyToMessageId: string | null = null,
  ): Promise<SendResult> {
    return this.sendMediaMessage(to, 'document', url, true, { caption, filename: fileName }, replyToMessageId);
  }

  /** Send a sticker uploaded to Meta (by media ID). */
  sendStickerMessage(to: string, mediaId: string, replyToMessageId: string | null = null): Promise<SendResult> {
    return this.sendMediaMessage(to, 'sticker', mediaId, false, {}, replyToMessageId);
  }

  /** Send a sticker hosted on a public URL. */
  sendStickerMessageByUrl(to: string, url: string, replyToMessageId: string | null = null): Promise<SendResult> {
    return this.sendMediaMessage(to, 'sticker', url, true, {}, replyToMessageId);
  }

  /** Send a video uploaded to Meta (by media ID). */
  sendVideoMessage(to: string, mediaId: string, caption: string | null = null, replyToMessageId: string | null = null): Promise<SendResult> {
    return this.sendMediaMessage(to, 'video', mediaId, false, { caption }, replyToMessageId);
  }

  /** Send a video hosted on a public URL. */
  sendVideoMessageByUrl(to: string, url: string, caption: string | null = null, replyToMessageId: string | null = null): Promise<SendResult> {
    return this.sendMediaMessage(to, 'video', url, true, { caption }, replyToMessageId);
  }

  /** Send one or more contact cards (contact objects per the Meta schema). */
  sendContactsMessage(to: string, contacts: JsonObject[], replyToMessageId: string | null = null): Promise<SendResult> {
    return this.send(to, compact({
      type: 'contacts',
      contacts,
      context: this.replyContext(replyToMessageId),
    }));
  }

  /** Send a location pin. */
  sendLocationMessage(
    to: string,
    latitude: number,
    longitude: number,
    name: string | null = null,
    address: string | null = null,
    replyToMessageId: string | null = null,
  ): Promise<SendResult> {
    return this.send(to, compact({
      type: 'location',
      location: compact({ latitude, longitude, name, address }),
      context: this.replyContext(replyToMessageId),
    }));
  }

  /**
   * Send a raw interactive message payload (lists, reply buttons, products,
   * catalog, order details/status, flows, etc.) per the Meta schema.
   */
  sendInteractiveMessage(to: string, interactive: JsonObject, replyToMessageId: string | null = null): Promise<SendResult> {
    return this.send(to, compact({
      type: 'interactive',
      interactive,
      context: this.replyContext(replyToMessageId),
    }));
  }

  /** Send an interactive list message (up to 10 sections/rows). */
  sendListMessage(
    to: string,
    bodyText: string,
    buttonText: string,
    sections: JsonObject[],
    header: JsonObject | null = null,
    footer: string | null = null,
    replyToMessageId: string | null = null,
  ): Promise<SendResult> {
    return this.sendInteractiveMessage(to, compact({
      type: 'list',
      header,
      body: { text: bodyText },
      footer: footer !== null ? { text: footer } : null,
      action: { button: buttonText, sections },
    }), replyToMessageId);
  }

  /** Send an interactive reply-button message (up to 3 buttons). */
  sendReplyButtonsMessage(
    to: string,
    bodyText: string,
    buttons: ReplyButton[],
    header: JsonObject | null = null,
    footer: string | null = null,
    replyToMessageId: string | null = null,
  ): Promise<SendResult> {
    return this.sendInteractiveMessage(to, compact({
      type: 'button',
      header,
      body: { text: bodyText },
      footer: footer !== null ? { text: footer } : null,
      action: { buttons: buttons.map((button) => ({ type: 'reply', reply: button })) },
    }), replyToMessageId);
  }

  /** Send a pre-approved template message with its component parameters. */
  sendTemplateMessage(to: string, templateName: string, language = 'en', components: JsonObject[] = []): Promise<SendResult> {
    const template: JsonObject = { name: templateName, language: { code: language } };

    if (components.length > 0) {
      template.components = components;
    }

    return this.send(to, { type: 'template', template });
  }

  /** Send a single product message from a linked catalog. */
  sendSingleProductMessage(
    to: string,
    catalogId: string,
    productRetailerId: string,
    bodyText: string,
    footer: string | null = null,
  ): Promise<SendResult> {
    return this.sendInteractiveMessage(to, compact({
      type: 'product',
      body: { text: bodyText },
      footer: footer !== null ? { text: footer } : null,
      action: { catalog_id: catalogId, product_retailer_id: productRetailerId },
    }));
  }

  /** Send a multi-product message from a linked catalog. */
  sendMultiProductMessage(
    to: string,
    catalogId: string,
    bodyText: string,
    sections: JsonObject[],
    header: JsonObject | null = null,
  ): Promise<SendResult> {
    return this.sendInteractiveMessage(to, compact({
      type: 'product_list',
      header,
      body: { text: bodyText },
      action: { catalog_id: catalogId, sections },
    }));
  }

  /** Send a catalog message inviting the customer to browse the full catalog. */
  sendCatalogMessage(
    to: string,
    bodyText: string,
    footer: string | null = null,
    thumbnailProductRetailerId: string | null = null,
  ): Promise<SendResult> {
    return this.sendInteractiveMessage(to, compact({
      type: 'catalog_message',
      body: { text: bodyText },
      footer: footer !== null ? { text: footer } : null,
      action: compact({
        name: 'catalog_message',
        parameters:
          thumbnailProductRetailerId !== null ? { thumbnail_product_retailer_id: thumbnailProductRetailerId } : null,
      }),
    }));
  }

  /** Mark a received message as read. */
  async markMessageAsRead(messageId: string): Promise<ApiResult> {
    const phoneNumberId = this.client.phoneNumberId();

    if (!this.client.isConfigured() || !phoneNumberId) {
      return this.client.unconfiguredResponse('mark message as read');
    }

    return this.client.put(`${phoneNumberId}/messages`, {
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId,
    });
  }

  /** Send a typing indicator (also marks the triggering message as read). */
  sendTypingIndicator(to: string, messageId: string): Promise<SendResult> {
    return this.send(to, {
      status: 'read',
      message_id: messageId,
      typing_indicator: { type: 'text' },
    });
  }

  /**
   * Send any media message type either by Meta media ID or by public URL.
   *
   * @param options Extra media fields (caption, filename).
   */
  sendMediaMessage(
    to: string,
    type: string,
    media: string,
    isLink = false,
    options: Record<string, string | null | undefined> = {},
    replyToMessageId: string | null = null,
  ): Promise<SendResult> {
    return this.send(to, compact({
      type,
      [type]: compact({ [isLink ? 'link' : 'id']: media, ...options }),
      context: this.replyContext(replyToMessageId),
    }));
  }

  /** Post a payload to the messages endpoint and normalize the result. */
  private async send(to: string, payload: JsonObject): Promise<SendResult> {
    const phoneNumberId = this.client.phoneNumberId();

    if (!this.client.isConfigured() || !phoneNumberId) {
      this.client.logger.error('[WhatsApp] Cannot send message: API token or phone number ID is not configured.');

      return { success: false, message_id: null, error: 'WhatsApp API is not configured.' };
    }

    const result = await this.client.post(`${phoneNumberId}/messages`, {
      messaging_product: 'whatsapp',
      to: this.normalizePhoneNumber(to),
      ...payload,
    });

    const type = payload.type ?? 'status';

    if (result.success) {
      const messageId: string | null = result.data.messages?.[0]?.id ?? null;
      this.client.logger.info('[WhatsApp] Message sent.', { to, type, message_id: messageId });

      return { success: true, message_id: messageId, error: null };
    }

    this.client.logger.error('[WhatsApp] Failed to send message.', {
      to,
      type,
      status: result.status,
      error: result.error,
    });

    return { success: false, message_id: null, error: result.error };
  }

  /** Build the reply context object when replying to a message. */
  private replyContext(replyToMessageId: string | null): { message_id: string } | null {
    return replyToMessageId !== null ? { message_id: replyToMessageId } : null;
  }

  /** Normalize a phone number by stripping every non-digit character. */
  private normalizePhoneNumber(phone: string): string {
    return phone.replace(/[^0-9]/g, '');
  }
}
