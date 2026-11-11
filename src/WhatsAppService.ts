import { AccountService } from './AccountService.js';
import { AnalyticsService } from './AnalyticsService.js';
import { BlockUserService } from './BlockUserService.js';
import { BusinessProfileService } from './BusinessProfileService.js';
import { CloudApiClient } from './CloudApiClient.js';
import { CommerceService } from './CommerceService.js';
import { FlowService } from './FlowService.js';
import { MediaService } from './MediaService.js';
import { MessageService } from './MessageService.js';
import { PhoneNumberService } from './PhoneNumberService.js';
import { QrCodeService } from './QrCodeService.js';
import { TemplateService } from './TemplateService.js';
import type { JsonObject, SendResult, TemplateStatusResult, WhatsAppConfig } from './types.js';

/**
 * High-level entry point for the WhatsApp Cloud API (Meta).
 *
 * Composes one domain service per API surface, mirroring the official
 * "WhatsApp Cloud API" Postman collection:
 *
 * - messages        Send text/media/interactive/template messages, read receipts, typing
 * - templates       Template CRUD, namespace, status, Meta error classification
 * - media           Media upload, download, deletion
 * - phoneNumbers    Phone number discovery, registration, verification
 * - account         WABA, business portfolios, app subscription, billing, tokens
 * - businessProfile Business profile and resumable uploads
 * - qrCodes         Message QR code management
 * - analytics       Messaging and conversation analytics
 * - blockUsers      Blocked user management
 * - commerce        Cart and catalog visibility settings
 * - flows           WhatsApp Flows and endpoint encryption
 */
export class WhatsAppService {
  readonly client: CloudApiClient;
  readonly messages: MessageService;
  readonly templates: TemplateService;
  readonly media: MediaService;
  readonly phoneNumbers: PhoneNumberService;
  readonly account: AccountService;
  readonly businessProfile: BusinessProfileService;
  readonly qrCodes: QrCodeService;
  readonly analytics: AnalyticsService;
  readonly blockUsers: BlockUserService;
  readonly commerce: CommerceService;
  readonly flows: FlowService;

  /** Pass config, an existing client, or nothing to read the WHATSAPP_* env vars. */
  constructor(config: WhatsAppConfig | CloudApiClient = {}) {
    this.client = config instanceof CloudApiClient ? config : new CloudApiClient(config);
    this.messages = new MessageService(this.client);
    this.templates = new TemplateService(this.client);
    this.media = new MediaService(this.client);
    this.phoneNumbers = new PhoneNumberService(this.client);
    this.account = new AccountService(this.client);
    this.businessProfile = new BusinessProfileService(this.client);
    this.qrCodes = new QrCodeService(this.client);
    this.analytics = new AnalyticsService(this.client);
    this.blockUsers = new BlockUserService(this.client);
    this.commerce = new CommerceService(this.client);
    this.flows = new FlowService(this.client);
  }

  /** Send a pre-approved template message via the WhatsApp Cloud API. */
  sendTemplateMessage(to: string, templateName: string, language = 'en', components: JsonObject[] = []): Promise<SendResult> {
    return this.messages.sendTemplateMessage(to, templateName, language, components);
  }

  /** Check the approval status of a template from Meta. */
  getTemplateStatus(metaTemplateId: string): Promise<TemplateStatusResult> {
    return this.templates.getTemplateStatus(metaTemplateId);
  }

  /** Send a test message using the hello_world template. */
  sendTestMessage(to: string): Promise<SendResult> {
    return this.messages.sendTemplateMessage(to, 'hello_world', 'en_US');
  }
}
