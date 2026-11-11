import type { CloudApiClient } from './CloudApiClient.js';
import type { ApiResult, JsonObject, QueryParams, TemplateStatusResult } from './types.js';

/** The parts of a failed result the error classifiers look at. */
type FailedResult = Pick<ApiResult, 'data' | 'error'>;

/**
 * Manages WhatsApp message templates via the Business Management API.
 *
 * Wraps the /{WABA-ID}/message_templates endpoints from the official
 * "WhatsApp Cloud API" Postman collection (Templates).
 */
export class TemplateService {
  constructor(readonly client: CloudApiClient) {}

  /** Get a template by its Meta template ID. */
  getTemplateById(templateId: string, fields: string[] = []): Promise<ApiResult> {
    return this.client.get(templateId, fields.length > 0 ? { fields: fields.join(',') } : {});
  }

  /** Get a template by its exact name. */
  async getTemplateByName(name: string, businessAccountId: string | null = null): Promise<ApiResult> {
    const accountId = this.client.businessAccountId(businessAccountId);

    if (!accountId) {
      return this.client.unconfiguredResponse('get template by name');
    }

    return this.client.get(`${accountId}/message_templates`, { name });
  }

  /**
   * List all templates on the WhatsApp Business Account.
   *
   * @param query Optional filters (limit, after, category, ...).
   */
  async getTemplates(query: QueryParams = {}, businessAccountId: string | null = null): Promise<ApiResult> {
    const accountId = this.client.businessAccountId(businessAccountId);

    if (!accountId) {
      return this.client.unconfiguredResponse('list templates');
    }

    return this.client.get(`${accountId}/message_templates`, query);
  }

  /** Get the message template namespace of the WhatsApp Business Account. */
  async getNamespace(businessAccountId: string | null = null): Promise<ApiResult> {
    const accountId = this.client.businessAccountId(businessAccountId);

    if (!accountId) {
      return this.client.unconfiguredResponse('get template namespace');
    }

    return this.client.get(accountId, { fields: 'message_template_namespace' });
  }

  /**
   * Create a message template (authentication, catalog, multi-product,
   * text/media/location headers, buttons, flows, ...).
   *
   * @param components Template components per the Meta schema.
   */
  async createTemplate(
    name: string,
    language: string,
    category: string,
    components: JsonObject[],
    businessAccountId: string | null = null,
  ): Promise<ApiResult> {
    const accountId = this.client.businessAccountId(businessAccountId);

    if (!accountId) {
      return this.client.unconfiguredResponse('create template');
    }

    return this.client.post(`${accountId}/message_templates`, { name, language, category, components });
  }

  /**
   * Edit an existing template (components and/or category).
   *
   * @param payload Fields to update, e.g. `{ components: [...] }`.
   */
  editTemplate(templateId: string, payload: JsonObject): Promise<ApiResult> {
    return this.client.post(templateId, payload);
  }

  /**
   * Whether a failed Meta response reports that a template with the same
   * name and language already exists (subcode 2388024).
   */
  isDuplicateLanguageError(result: FailedResult): boolean {
    return this.matchesError(result, 2388024, 'Content in this language already exists');
  }

  /**
   * Whether a failed Meta response reports the name+language pair is
   * locked mid-deletion (subcode 2388023) — new content in that language
   * is rejected for up to four weeks.
   */
  isLanguageDeletionError(result: FailedResult): boolean {
    return this.matchesError(result, 2388023, 'Message template language is being deleted');
  }

  /**
   * Whether a failed Meta response reports the submitted category does
   * not match the category Meta already associates with the existing
   * template (subcode 2388026) — Meta recategorizes templates (e.g.
   * UTILITY → MARKETING) during review.
   */
  isCategoryMismatchError(result: FailedResult): boolean {
    return this.matchesError(result, 2388026, "doesn't match the one that's already associated");
  }

  /**
   * Bump the version suffix of a template name: sample_request becomes
   * sample_request_v2, sample_request_v2 becomes sample_request_v3.
   */
  nextTemplateName(name: string): string {
    const match = /_v(\d+)$/.exec(name);

    return match ? name.replace(/_v\d+$/, `_v${Number(match[1]) + 1}`) : `${name}_v2`;
  }

  /** Fetch the category Meta currently associates with a template. */
  async getTemplateCategory(metaTemplateId: string): Promise<string | null> {
    const result = await this.getTemplateById(metaTemplateId, ['category']);

    if (!result.success) {
      return null;
    }

    return String(result.data.category ?? '').toUpperCase() || null;
  }

  /**
   * Delete a template by name.
   *
   * Deletes every language variant of the name on the WhatsApp Business
   * Account — Meta has no language-scoped deletion.
   */
  async deleteTemplateByName(name: string, businessAccountId: string | null = null): Promise<ApiResult> {
    const accountId = this.client.businessAccountId(businessAccountId);

    if (!accountId) {
      return this.client.unconfiguredResponse('delete template');
    }

    return this.client.delete(`${accountId}/message_templates`, { name });
  }

  /** Delete a template by Meta template ID (the name is required by Meta as well). */
  async deleteTemplateById(templateId: string, name: string, businessAccountId: string | null = null): Promise<ApiResult> {
    const accountId = this.client.businessAccountId(businessAccountId);

    if (!accountId) {
      return this.client.unconfiguredResponse('delete template');
    }

    return this.client.delete(`${accountId}/message_templates`, { hsm_id: templateId, name });
  }

  /** Check the approval status and current category of a template from Meta. */
  async getTemplateStatus(metaTemplateId: string): Promise<TemplateStatusResult> {
    const result = await this.client.get(metaTemplateId, { fields: 'status,category' });

    if (!result.success) {
      return { success: false, status: null, category: null, error: result.error };
    }

    return {
      success: true,
      status: String(result.data.status ?? 'PENDING').toLowerCase(),
      category: String(result.data.category ?? '').toUpperCase() || null,
      error: null,
    };
  }

  private matchesError(result: FailedResult, subcode: number, message: string): boolean {
    return Number(result.data?.error?.error_subcode ?? 0) === subcode || (result.error ?? '').includes(message);
  }
}
