# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm test                                   # vitest run (all tests)
npx vitest run tests/WebhookVerifier.test.ts   # one test file
npx vitest run -t "does not retry a failed POST"  # tests matching a name
npm run typecheck                          # tsc --noEmit over src/ and tests/
npm run build                              # tsup → dist/ (ESM + CJS + .d.ts, target node18)
```

CI (`.github/workflows/tests.yml`) runs typecheck, test and build on Node 18, 20 and 22, so don't use APIs newer than Node 18. `prepublishOnly` runs the same three steps.

Releasing: bump `version` in `package.json`, add a `CHANGELOG.md` entry, push, then publish a GitHub release tagged `v<version>`. `.github/workflows/release.yml` publishes to npm via trusted publishing (OIDC, no token). It fails if the tag doesn't match `package.json`, and sends pre-release versions (`-beta.1` etc.) to the `next` dist-tag.

## What this is

A zero-runtime-dependency TypeScript client for Meta's WhatsApp Cloud API. It is a **port of the Laravel package `ahmednour/laravel-whatsapp-cloud-api`** and deliberately keeps parity with it: same service names, method names, argument order and result shapes (including snake_case result keys like `message_id` and `media_id`). Endpoint coverage mirrors the official "WhatsApp Cloud API" Postman collection. When adding or changing methods, keep them consistent with the PHP package. Any intentional divergence goes in the README's "Differences from the Laravel package" section.

## Architecture

- **`CloudApiClient`** is the only class that does HTTP. It handles auth headers, URL building, config resolution, timeouts, retries and result normalization. It uses an injectable `fetch` (`config.fetch`), falling back to `globalThis.fetch`.
- **Domain services** (`MessageService`, `TemplateService`, `MediaService`, …) each take a `CloudApiClient` in their constructor and map one API surface onto `client.get/post/put/delete/postMultipart/postBinary/download`. They build payloads and paths and contain no HTTP logic.
- **`WhatsAppService`** is the aggregate facade. It builds one client and exposes every domain service as a property (`whatsApp.messages`, `.templates`, …), plus a few shortcuts (`sendTemplateMessage`, `getTemplateStatus`, `sendTestMessage`).
- **`WebhookVerifier`** stands alone and is framework-agnostic (GET handshake + `X-Hub-Signature-256`). `hasValidSignature` must stay fail-closed: it returns `false` when no app secret is configured.
- Everything public is re-exported from `src/index.ts`, and shared types live in `src/types.ts`. A new service or type has to be added there and, if it is a service, wired into `WhatsAppService`.

### Invariants to preserve

- **Never throw on API or network failures.** Every call resolves to a result object: `ApiResult` `{ success, data, error, status }` (`status: 0` means no HTTP response), or the send-style shortcuts `SendResult` `{ success, message_id, error }` and `UploadResult` `{ success, media_id, error }`.
- **Only GETs (and `download`) are retried**, once, on network errors, 429 and 5xx. POST/PUT/DELETE must never retry, because a timed-out send could produce a duplicate message.
- **Config resolution:** explicit constructor options win over `WHATSAPP_*` env vars. Env vars are read lazily at call time, not at construction. `.env` files are not loaded.
- **Missing-config guard pattern:** methods that need a phone number ID or WABA ID resolve it via `client.phoneNumberId(override)` / `client.businessAccountId(override)` (an optional trailing argument overrides config). If it is missing, they return `client.unconfiguredResponse('<action>')` without sending a request. `MessageService` also checks `client.isConfigured()` (API token).
- Use `compact()` from `CloudApiClient.ts` to drop `null`/`undefined` optional fields from payloads. `buildQuery()` encodes nested query params with bracket notation and booleans as `1`/`0`.
- `DELETE` sends filters as query params, unless a JSON body is passed, in which case the query is ignored.
- Meta error messages are flattened by `extractError` into one `' | '`-joined string (message, user title/msg, details, subcode, trace ID).
- Logging is silent by default. Services log through `client.logger` with a `[WhatsApp]` prefix.

## Conventions

- ESM source with `.js` extensions on relative imports (`'./types.js'`). `moduleResolution: Bundler`, `strict`, `noUncheckedIndexedAccess`, so tests index arrays with `!` (e.g. `requests[0]!.url`).
- Tests never hit the network. `tests/helpers.ts` provides `fakeFetch(...responses)`, which records requests (parsed JSON body included) and replays queued responses; the last response repeats, and an `Error` simulates a network failure. It also provides `makeService(fetch, overrides)`, which builds a fully configured `WhatsAppService` with `retryDelayMs: 0`. Tests assert on the exact URL, method, headers and JSON payload sent.
