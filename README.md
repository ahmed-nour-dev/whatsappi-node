# whatsappi-node

A Node.js client for [Meta's WhatsApp Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api) —
messages, templates, media, phone numbers, flows, QR codes, analytics, commerce settings and webhook
verification, mirroring the official "WhatsApp Cloud API" Postman collection.

It is the Node.js port of [`ahmednour/laravel-whatsapp-cloud-api`](https://github.com/ahmed-nour-dev/whatsappi):
the same services, the same method names and argument order, and the same normalized results, so
code moves between the two with little more than `->` becoming `.` and an `await`.

- Zero runtime dependencies — uses the `fetch` built into Node 18+
- Written in TypeScript, ships ESM and CommonJS builds with type definitions
- Never throws on API or network failures — every call resolves to a result object

## Installation

```bash
npm install whatsappi-node
```

Set the environment variables (the same ones the Laravel package uses):

```env
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_BUSINESS_ACCOUNT_ID=
WHATSAPP_API_TOKEN=
WHATSAPP_VERIFY_TOKEN=
WHATSAPP_APP_SECRET=
WHATSAPP_API_URL=https://graph.facebook.com/v21.0
```

The package reads `process.env` but does not load `.env` files itself — use `node --env-file=.env`
or `dotenv` for that. You can also pass everything explicitly; explicit options win over the
environment:

```js
const whatsApp = new WhatsAppService({
  apiToken: '...',
  phoneNumberId: '...',
  businessAccountId: '...',
  verifyToken: '...',
  appSecret: '...',
  apiUrl: 'https://graph.facebook.com/v21.0',
  logger: console, // optional, silent by default
});
```

## Usage

Create one `WhatsAppService` — it composes one domain service per API surface:

```js
import { WhatsAppService } from 'whatsappi-node';
// const { WhatsAppService } = require('whatsappi-node');

const whatsApp = new WhatsAppService();

const result = await whatsApp.messages.sendTextMessage('15551234567', 'Hello!');

// result is { success: true, message_id: 'wamid...', error: null }
```

Every call resolves to a normalized object — `{ success, data, error, status }` for most endpoints,
with a few send-oriented shortcuts (`{ success, message_id, error }`, `{ success, media_id, error }`)
for the most common calls. Failures are reported through `success: false` and `error`, never by
throwing; `status` is `0` when no HTTP response was received.

### Domain services

| Property | Service | Covers |
|---|---|---|
| `messages` | `MessageService` | Text/media/interactive/template/reaction messages, read receipts, typing indicator |
| `templates` | `TemplateService` | Template CRUD, namespace, status, Meta error classification |
| `media` | `MediaService` | Upload, retrieve URL, download, delete |
| `phoneNumbers` | `PhoneNumberService` | Discovery, registration, verification |
| `account` | `AccountService` | WABA, business portfolios, app subscription, billing, token debug |
| `businessProfile` | `BusinessProfileService` | Business profile fields, resumable uploads |
| `qrCodes` | `QrCodeService` | Message QR code (click-to-chat) management |
| `analytics` | `AnalyticsService` | Messaging and conversation analytics |
| `blockUsers` | `BlockUserService` | Blocked user management |
| `commerce` | `CommerceService` | Cart and catalog visibility settings |
| `flows` | `FlowService` | WhatsApp Flows, assets, publishing, endpoint encryption |

Each is also usable on its own if you don't need the full aggregate:

```js
import { CloudApiClient, MessageService } from 'whatsappi-node';

const messages = new MessageService(new CloudApiClient());
```

### Sending messages

```js
await whatsApp.messages.sendTextMessage('15551234567', 'Your order shipped!');
await whatsApp.messages.sendImageMessageByUrl('15551234567', 'https://example.com/receipt.png');
await whatsApp.messages.sendTemplateMessage('15551234567', 'order_update', 'en', [
  { type: 'body', parameters: [{ type: 'text', text: 'John' }] },
]);
await whatsApp.messages.sendReplyButtonsMessage('15551234567', 'Confirm your booking?', [
  { id: 'yes', title: 'Yes' },
  { id: 'no', title: 'No' },
]);
```

Phone numbers are normalized for you — `'+20 100 555 1234'` is sent as `201005551234`.

### Media

```js
import { readFile } from 'node:fs/promises';

const upload = await whatsApp.media.uploadMedia(await readFile('invoice.pdf'), 'application/pdf', 'invoice.pdf');
await whatsApp.messages.sendDocumentMessage('15551234567', upload.media_id, 'Your invoice', 'invoice.pdf');

// Incoming media: resolve the temporary URL, then download it as a Buffer
const { data } = await whatsApp.media.getMediaUrl('media-id-from-webhook');
const file = await whatsApp.media.downloadMedia(data.url);
```

### Templates

```js
await whatsApp.templates.createTemplate('order_ready', 'en', 'UTILITY', [
  { type: 'BODY', text: 'Hi {{1}}, your order is ready.' },
]);

await whatsApp.getTemplateStatus('meta-template-id'); // { success: true, status: 'approved', category: 'UTILITY', error: null }
```

`TemplateService` also exposes Meta's template-submission error classifiers
(`isDuplicateLanguageError`, `isLanguageDeletionError`, `isCategoryMismatchError`,
`nextTemplateName`) so an app building its own submit-with-versioned-retry workflow on top of
`createTemplate`/`editTemplate` doesn't have to reimplement Meta's subcode handling.

### Webhooks

`WebhookVerifier` validates both parts of the Meta webhook contract — the one-time GET handshake and
the `X-Hub-Signature-256` header on every event delivery — without any framework coupling. With
Express:

```js
import express from 'express';
import { WebhookVerifier } from 'whatsappi-node';

const app = express();
const verifier = new WebhookVerifier();

app.get('/webhook', (req, res) => {
  if (!verifier.isValidSubscriptionRequest(req.query['hub.mode'], req.query['hub.verify_token'])) {
    return res.sendStatus(403);
  }

  res.status(200).send(req.query['hub.challenge']);
});

// The signature covers the raw body, so capture it before any JSON parsing
app.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  if (!verifier.hasValidSignature(req.body, req.get('X-Hub-Signature-256'))) {
    return res.status(403).json({ status: 'forbidden' });
  }

  const event = JSON.parse(req.body.toString());
  // ...
  res.sendStatus(200);
});
```

`hasValidSignature` fails closed — it returns `false` (not `true`) when no app secret is configured,
so an unconfigured webhook can never be spoofed by omission.

## Differences from the Laravel package

- Calls are asynchronous and return promises.
- Config keys are camelCase (`apiToken`, `phoneNumberId`, ...); the environment variable names are identical.
- Result keys keep the PHP names (`message_id`, `media_id`), so result-handling code ports as is.
- File contents are a `Buffer`/`Uint8Array`/`Blob`/string; `downloadMedia` returns a `Buffer`.
- GET requests are retried once on network errors, HTTP 429 and 5xx only. POST/PUT/DELETE are never
  retried, so a timed-out send can't produce a duplicate message.
- `sendCatalogMessage(to, bodyText, footer, thumbnailProductRetailerId)` drops the PHP version's
  unused third `$parameterValue` argument.
- Logging is off unless you pass a `logger` (anything with `info`/`warn`/`error`, e.g. `console`).

## Testing

```bash
npm test
npm run typecheck
```

## License

MIT.
