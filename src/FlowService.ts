import type { CloudApiClient } from './CloudApiClient.js';
import type { ApiResult, JsonObject, QueryParams } from './types.js';

/**
 * Manages WhatsApp Flows and endpoint encryption keys.
 *
 * Wraps the /{WABA-ID}/flows, /{Flow-ID} and whatsapp_business_encryption
 * endpoints from the official "WhatsApp Cloud API" Postman collection (Flows).
 */
export class FlowService {
  constructor(readonly client: CloudApiClient) {}

  /**
   * Create a flow on the WhatsApp Business Account.
   *
   * @param categories e.g. ['LEAD_GENERATION'].
   */
  async createFlow(name: string, categories: string[], businessAccountId: string | null = null): Promise<ApiResult> {
    const accountId = this.client.businessAccountId(businessAccountId);

    if (!accountId) {
      return this.client.unconfiguredResponse('create flow');
    }

    return this.client.post(`${accountId}/flows`, { name, categories });
  }

  /** Get a single flow with the requested fields. */
  getFlow(
    flowId: string,
    fields: string[] = ['id', 'name', 'categories', 'status', 'validation_errors', 'json_version'],
  ): Promise<ApiResult> {
    return this.client.get(flowId, { fields: fields.join(',') });
  }

  /** List all flows on the WhatsApp Business Account. */
  async getFlows(businessAccountId: string | null = null, query: QueryParams = {}): Promise<ApiResult> {
    const accountId = this.client.businessAccountId(businessAccountId);

    if (!accountId) {
      return this.client.unconfiguredResponse('list flows');
    }

    return this.client.get(`${accountId}/flows`, query);
  }

  /** Get the preview URL of a flow. */
  getPreviewUrl(flowId: string): Promise<ApiResult> {
    return this.client.get(flowId, { fields: 'preview.invalidate(false)' });
  }

  /** Update flow metadata (name, categories, ...). */
  updateFlowMetadata(flowId: string, metadata: JsonObject): Promise<ApiResult> {
    return this.client.post(flowId, metadata);
  }

  /**
   * Upload (replace) the Flow JSON asset of a flow.
   *
   * @param flowJson Raw Flow JSON contents.
   */
  updateFlowJson(flowId: string, flowJson: string, name = 'flow.json', validate = true): Promise<ApiResult> {
    return this.client.postMultipart(`${flowId}/assets`, flowJson, name, 'application/json', {
      name,
      asset_type: 'FLOW_JSON',
      validate: validate ? 'true' : 'false',
    });
  }

  /** Publish a draft flow so it can be sent to customers. */
  publishFlow(flowId: string): Promise<ApiResult> {
    return this.client.post(`${flowId}/publish`);
  }

  /** Deprecate a published flow. */
  deprecateFlow(flowId: string): Promise<ApiResult> {
    return this.client.post(`${flowId}/deprecate`);
  }

  /** Delete a flow. */
  deleteFlow(flowId: string): Promise<ApiResult> {
    return this.client.delete(flowId);
  }

  /** Migrate flows from another WABA into the current one. */
  async migrateFlows(sourceWabaId: string, sourceFlowIds: string[], businessAccountId: string | null = null): Promise<ApiResult> {
    const accountId = this.client.businessAccountId(businessAccountId);

    if (!accountId) {
      return this.client.unconfiguredResponse('migrate flows');
    }

    return this.client.post(`${accountId}/migrate_flows`, {
      source_waba_id: sourceWabaId,
      source_flow_ids: sourceFlowIds,
    });
  }

  /** Set the endpoint encryption public key for the phone number. */
  async setEncryptionPublicKey(publicKey: string, phoneNumberId: string | null = null): Promise<ApiResult> {
    const id = this.client.phoneNumberId(phoneNumberId);

    if (!id) {
      return this.client.unconfiguredResponse('set encryption public key');
    }

    return this.client.post(`${id}/whatsapp_business_encryption`, { business_public_key: publicKey });
  }

  /** Get the endpoint encryption public key of the phone number. */
  async getEncryptionPublicKey(phoneNumberId: string | null = null): Promise<ApiResult> {
    const id = this.client.phoneNumberId(phoneNumberId);

    if (!id) {
      return this.client.unconfiguredResponse('get encryption public key');
    }

    return this.client.get(`${id}/whatsapp_business_encryption`);
  }

  /**
   * Get an endpoint metric for a flow (request counts, errors, latency, ...).
   *
   * @param metricName e.g. ENDPOINT_REQUEST_COUNT, ENDPOINT_REQUEST_ERROR,
   *   ENDPOINT_REQUEST_ERROR_RATE, ENDPOINT_REQUEST_LATENCY_SECONDS_CEIL,
   *   ENDPOINT_AVAILABILITY.
   * @param granularity DAY or LIFETIME.
   */
  getFlowMetric(
    flowId: string,
    metricName: string,
    granularity = 'DAY',
    since: string | null = null,
    until: string | null = null,
  ): Promise<ApiResult> {
    let fields = `metric.name(${metricName}).granularity(${granularity})`;

    if (since !== null) {
      fields += `.since(${since})`;
    }

    if (until !== null) {
      fields += `.until(${until})`;
    }

    return this.client.get(flowId, { fields });
  }
}
