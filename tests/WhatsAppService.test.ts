import { afterEach, describe, expect, it, vi } from 'vitest';
import { MessageService, CloudApiClient, WhatsAppService } from '../src/index.js';
import { fakeFetch, makeService } from './helpers.js';

const BASE = 'https://graph.facebook.com/v21.0';

describe('messages', () => {
  it('posts the expected payload for a text message', async () => {
    const { fetch, requests } = fakeFetch({ body: { messages: [{ id: 'wamid.abc123' }] } });

    const result = await makeService(fetch).messages.sendTextMessage('+20 100 555 1234', 'Hello there', true);

    expect(result).toEqual({ success: true, message_id: 'wamid.abc123', error: null });
    expect(requests).toHaveLength(1);
    expect(requests[0]!.url).toBe(`${BASE}/123456789/messages`);
    expect(requests[0]!.method).toBe('POST');
    expect(requests[0]!.headers.Authorization).toBe('Bearer test-token');
    expect(requests[0]!.json).toEqual({
      messaging_product: 'whatsapp',
      to: '201005551234',
      type: 'text',
      text: { body: 'Hello there', preview_url: true },
    });
  });

  it('returns the Meta error on API failure', async () => {
    const { fetch } = fakeFetch({ status: 400, body: { error: { message: 'Invalid phone number' } } });

    const result = await makeService(fetch).messages.sendTextMessage('123', 'Hi');

    expect(result).toEqual({ success: false, message_id: null, error: 'Invalid phone number' });
  });

  it('fails without sending when not configured', async () => {
    const { fetch, requests } = fakeFetch();

    const result = await makeService(fetch, { apiToken: null }).messages.sendTextMessage('123', 'Hi');

    expect(result.success).toBe(false);
    expect(result.error).toBe('WhatsApp API is not configured.');
    expect(requests).toHaveLength(0);
  });

  it('does not retry a failed POST', async () => {
    const { fetch, requests } = fakeFetch({ status: 500, body: { error: { message: 'Server error' } } });

    const result = await makeService(fetch).messages.sendTextMessage('123', 'Hi');

    expect(result.success).toBe(false);
    expect(requests).toHaveLength(1);
  });

  it('sends template messages through the aggregate shortcut', async () => {
    const { fetch, requests } = fakeFetch({ body: { messages: [{ id: 'wamid.tpl1' }] } });

    const result = await makeService(fetch).sendTemplateMessage('15551234567', 'order_update', 'en', [
      { type: 'body', parameters: [{ type: 'text', text: 'John' }] },
    ]);

    expect(result).toEqual({ success: true, message_id: 'wamid.tpl1', error: null });
    expect(requests[0]!.json.type).toBe('template');
    expect(requests[0]!.json.template).toEqual({
      name: 'order_update',
      language: { code: 'en' },
      components: [{ type: 'body', parameters: [{ type: 'text', text: 'John' }] }],
    });
  });

  it('uses link instead of id for media sent by URL', async () => {
    const { fetch, requests } = fakeFetch({ body: { messages: [{ id: 'wamid.img' }] } });

    const result = await makeService(fetch).messages.sendDocumentMessageByUrl(
      '15551234567',
      'https://example.com/q.pdf',
      'Quote',
      'quote.pdf',
    );

    expect(result.success).toBe(true);
    expect(requests[0]!.json.type).toBe('document');
    expect(requests[0]!.json.document).toEqual({
      link: 'https://example.com/q.pdf',
      caption: 'Quote',
      filename: 'quote.pdf',
    });
  });

  it('omits unset optional media fields', async () => {
    const { fetch, requests } = fakeFetch({ body: { messages: [{ id: 'wamid.img' }] } });

    await makeService(fetch).messages.sendImageMessage('15551234567', 'media-1');

    expect(requests[0]!.json.image).toEqual({ id: 'media-1' });
    expect(requests[0]!.json).not.toHaveProperty('context');
  });

  it('includes the reply context when replying to a message', async () => {
    const { fetch, requests } = fakeFetch({ body: { messages: [{ id: 'wamid.reply' }] } });

    await makeService(fetch).messages.sendTextMessage('15551234567', 'Got it', false, 'wamid.original');

    expect(requests[0]!.json.context).toEqual({ message_id: 'wamid.original' });
  });

  it('wraps reply buttons in the Meta button schema', async () => {
    const { fetch, requests } = fakeFetch({ body: { messages: [{ id: 'wamid.btn' }] } });

    await makeService(fetch).messages.sendReplyButtonsMessage('15551234567', 'Confirm?', [
      { id: 'yes', title: 'Yes' },
      { id: 'no', title: 'No' },
    ]);

    expect(requests[0]!.json.interactive).toEqual({
      type: 'button',
      body: { text: 'Confirm?' },
      action: {
        buttons: [
          { type: 'reply', reply: { id: 'yes', title: 'Yes' } },
          { type: 'reply', reply: { id: 'no', title: 'No' } },
        ],
      },
    });
  });

  it('marks a message as read with PUT', async () => {
    const { fetch, requests } = fakeFetch({ body: { success: true } });

    const result = await makeService(fetch).messages.markMessageAsRead('wamid.read1');

    expect(result.success).toBe(true);
    expect(requests[0]!.method).toBe('PUT');
    expect(requests[0]!.json).toMatchObject({ status: 'read', message_id: 'wamid.read1' });
  });

  it('sends the hello_world template as a test message', async () => {
    const { fetch, requests } = fakeFetch({ body: { messages: [{ id: 'wamid.test' }] } });

    const result = await makeService(fetch).sendTestMessage('15551234567');

    expect(result.success).toBe(true);
    expect(requests[0]!.json.template).toEqual({ name: 'hello_world', language: { code: 'en_US' } });
  });
});

describe('templates', () => {
  it('returns a lowercased status', async () => {
    const { fetch, requests } = fakeFetch({ body: { status: 'APPROVED', category: 'utility' } });

    const result = await makeService(fetch).getTemplateStatus('meta-tpl-1');

    expect(result).toEqual({ success: true, status: 'approved', category: 'UTILITY', error: null });
    expect(requests[0]!.url).toBe(`${BASE}/meta-tpl-1?fields=status%2Ccategory`);
  });

  it('lists templates on the WABA', async () => {
    const { fetch, requests } = fakeFetch({ body: { data: [{ name: 'order_ready' }] } });

    const result = await makeService(fetch).templates.getTemplates({ limit: 10 });

    expect(result.success).toBe(true);
    expect(result.data.data[0].name).toBe('order_ready');
    expect(requests[0]!.method).toBe('GET');
    expect(requests[0]!.url).toBe(`${BASE}/987654321/message_templates?limit=10`);
  });

  it('deletes by name using query parameters', async () => {
    const { fetch, requests } = fakeFetch({ body: { success: true } });

    await makeService(fetch).templates.deleteTemplateById('tpl-1', 'order_ready');

    expect(requests[0]!.method).toBe('DELETE');
    expect(requests[0]!.url).toBe(`${BASE}/987654321/message_templates?hsm_id=tpl-1&name=order_ready`);
    expect(requests[0]!.body).toBeUndefined();
  });
});

describe('other services', () => {
  it('registers a phone with its pin', async () => {
    const { fetch, requests } = fakeFetch({ body: { success: true } });

    const result = await makeService(fetch).phoneNumbers.registerPhone('123456');

    expect(result.success).toBe(true);
    expect(requests[0]!.url).toBe(`${BASE}/123456789/register`);
    expect(requests[0]!.json).toEqual({ messaging_product: 'whatsapp', pin: '123456' });
  });

  it('lists phone numbers on the WABA', async () => {
    const { fetch, requests } = fakeFetch({ body: { data: [{ id: '123456789' }] } });

    const result = await makeService(fetch).phoneNumbers.getPhoneNumbers();

    expect(result.success).toBe(true);
    expect(requests[0]!.method).toBe('GET');
    expect(requests[0]!.url).toBe(`${BASE}/987654321/phone_numbers`);
  });

  it('uploads media as multipart and returns the media id', async () => {
    const { fetch, requests } = fakeFetch({ body: { id: 'media-42' } });

    const result = await makeService(fetch).media.uploadMedia(Buffer.from('binary-contents'), 'image/png', 'logo.png');

    expect(result).toEqual({ success: true, media_id: 'media-42', error: null });
    expect(requests[0]!.url).toBe(`${BASE}/123456789/media`);

    const form = requests[0]!.body as FormData;
    const file = form.get('file') as File;

    expect(form.get('messaging_product')).toBe('whatsapp');
    expect(form.get('type')).toBe('image/png');
    expect(file.name).toBe('logo.png');
    expect(file.type).toBe('image/png');
    expect(await file.text()).toBe('binary-contents');
  });

  it('passes phone_number_id when deleting media', async () => {
    const { fetch, requests } = fakeFetch({ body: { success: true } });

    const result = await makeService(fetch).media.deleteMedia('media-42');

    expect(result.success).toBe(true);
    expect(requests[0]!.method).toBe('DELETE');
    expect(requests[0]!.url).toBe(`${BASE}/media-42?phone_number_id=123456789`);
  });

  it('downloads media as a Buffer', async () => {
    const { fetch, requests } = fakeFetch({ body: 'raw-bytes' });

    const result = await makeService(fetch).media.downloadMedia('https://lookaside.fbsbx.com/media/1');

    expect(result.success).toBe(true);
    expect(result.contents?.toString()).toBe('raw-bytes');
    expect(requests[0]!.headers.Authorization).toBe('Bearer test-token');
  });

  it('creates a QR code with a prefilled message', async () => {
    const { fetch, requests } = fakeFetch({ body: { code: 'QR1' } });

    const result = await makeService(fetch).qrCodes.createQrCode('Hello from ECC', 'SVG');

    expect(result.success).toBe(true);
    expect(requests[0]!.url).toBe(`${BASE}/123456789/message_qrdls`);
    expect(requests[0]!.json).toEqual({ prefilled_message: 'Hello from ECC', generate_qr_image: 'SVG' });
  });

  it('builds the analytics fields query', async () => {
    const { fetch, requests } = fakeFetch({ body: { analytics: {} } });

    const result = await makeService(fetch).analytics.getAnalytics(1680503760, 1680564980, 'DAY', [], ['US', 'BR']);

    expect(result.success).toBe(true);
    expect(new URL(requests[0]!.url).searchParams.get('fields')).toBe(
      'analytics.start(1680503760).end(1680564980).granularity(DAY).phone_numbers([]).country_codes(["US","BR"])',
    );
  });

  it('blocks users with the block_users payload', async () => {
    const { fetch, requests } = fakeFetch({ body: { success: true } });

    const result = await makeService(fetch).blockUsers.blockUsers(['15550001', '15550002']);

    expect(result.success).toBe(true);
    expect(requests[0]!.url).toBe(`${BASE}/123456789/block_users`);
    expect(requests[0]!.json).toEqual({
      messaging_product: 'whatsapp',
      block_users: [{ user: '15550001' }, { user: '15550002' }],
    });
  });

  it('unblocks users with a JSON body on DELETE', async () => {
    const { fetch, requests } = fakeFetch({ body: { success: true } });

    await makeService(fetch).blockUsers.unblockUsers(['15550001']);

    expect(requests[0]!.method).toBe('DELETE');
    expect(requests[0]!.url).toBe(`${BASE}/123456789/block_users`);
    expect(requests[0]!.json.block_users).toEqual([{ user: '15550001' }]);
  });

  it('subscribes the app to the WABA', async () => {
    const { fetch, requests } = fakeFetch({ body: { success: true } });

    const result = await makeService(fetch).account.subscribeApp();

    expect(result.success).toBe(true);
    expect(requests[0]!.method).toBe('POST');
    expect(requests[0]!.url).toBe(`${BASE}/987654321/subscribed_apps`);
  });

  it('lets an explicit id override the configured one', async () => {
    const { fetch, requests } = fakeFetch({ body: {} });

    await makeService(fetch).commerce.getCommerceSettings('555');

    expect(requests[0]!.url).toBe(`${BASE}/555/whatsapp_commerce_settings`);
  });

  it('returns the unconfigured result when an id is missing', async () => {
    const { fetch, requests } = fakeFetch();

    const result = await makeService(fetch, { businessAccountId: null }).flows.getFlows();

    expect(result).toEqual({ success: false, data: {}, error: 'WhatsApp API is not configured.', status: 0 });
    expect(requests).toHaveLength(0);
  });
});

describe('client', () => {
  it('combines Meta error details into one message', async () => {
    const { fetch } = fakeFetch({
      status: 400,
      body: {
        error: {
          message: 'Invalid parameter',
          error_user_title: 'Template rejected',
          error_user_msg: 'Fix the body',
          error_data: { details: 'Invalid parameter' },
          error_subcode: 2388024,
          fbtrace_id: 'AbC',
        },
      },
    });

    const result = await makeService(fetch).templates.createTemplate('t', 'en', 'UTILITY', []);

    expect(result.status).toBe(400);
    expect(result.error).toBe('Invalid parameter | Template rejected | Fix the body | Subcode: 2388024 | Trace ID: AbC');
    expect(result.data.error.error_subcode).toBe(2388024);
  });

  it('retries a GET once after a server error', async () => {
    const { fetch, requests } = fakeFetch({ status: 503, body: {} }, { body: { id: '1' } });

    const result = await makeService(fetch).account.getWaba();

    expect(result.success).toBe(true);
    expect(requests).toHaveLength(2);
  });

  it('does not retry a GET on a client error', async () => {
    const { fetch, requests } = fakeFetch({ status: 404, body: { error: { message: 'Not found' } } });

    const result = await makeService(fetch).account.getWaba();

    expect(result).toMatchObject({ success: false, error: 'Not found', status: 404 });
    expect(requests).toHaveLength(1);
  });

  it('reports connection failures with status 0 instead of throwing', async () => {
    const { fetch } = fakeFetch(new Error('getaddrinfo ENOTFOUND'));

    const result = await makeService(fetch).account.getWaba();

    expect(result).toEqual({
      success: false,
      data: {},
      error: 'Connection to the WhatsApp API failed: getaddrinfo ENOTFOUND',
      status: 0,
    });
  });

  it('survives a non-JSON error body', async () => {
    const { fetch } = fakeFetch({ status: 502, body: '<html>Bad Gateway</html>' });

    const result = await makeService(fetch).messages.markMessageAsRead('wamid.1');

    expect(result).toEqual({ success: false, data: {}, error: 'Unknown error', status: 502 });
  });
});

describe('configuration', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('falls back to WHATSAPP_* environment variables', async () => {
    vi.stubEnv('WHATSAPP_API_TOKEN', 'env-token');
    vi.stubEnv('WHATSAPP_PHONE_NUMBER_ID', '111');
    vi.stubEnv('WHATSAPP_API_URL', 'https://graph.facebook.com/v22.0/');

    const { fetch, requests } = fakeFetch({ body: { messages: [{ id: 'wamid.env' }] } });
    const result = await new WhatsAppService({ fetch }).messages.sendTextMessage('15551234567', 'Hi');

    expect(result.success).toBe(true);
    expect(requests[0]!.url).toBe('https://graph.facebook.com/v22.0/111/messages');
    expect(requests[0]!.headers.Authorization).toBe('Bearer env-token');
  });

  it('lets a single service be built on its own client', async () => {
    const { fetch, requests } = fakeFetch({ body: { messages: [{ id: 'wamid.solo' }] } });
    const messages = new MessageService(new CloudApiClient({ apiToken: 't', phoneNumberId: '42', fetch }));

    const result = await messages.sendReactionMessage('15551234567', 'wamid.x', '👍');

    expect(result.message_id).toBe('wamid.solo');
    expect(requests[0]!.url).toBe(`${BASE}/42/messages`);
  });

  it('writes to the configured logger', async () => {
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const { fetch } = fakeFetch({ body: { messages: [{ id: 'wamid.log' }] } });

    await makeService(fetch, { logger }).messages.sendTextMessage('15551234567', 'Hi');

    expect(logger.info).toHaveBeenCalledWith('[WhatsApp] Message sent.', {
      to: '15551234567',
      type: 'text',
      message_id: 'wamid.log',
    });
  });
});
