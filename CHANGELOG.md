# Changelog

All notable changes to `whatsappi-node` will be documented in this file.

## [1.0.0]

### Added

- Initial release: a Node.js port of `ahmednour/laravel-whatsapp-cloud-api`.
- `CloudApiClient`, the `WhatsAppService` aggregate, and eleven domain services
  (`AccountService`, `AnalyticsService`, `BlockUserService`, `BusinessProfileService`,
  `CommerceService`, `FlowService`, `MediaService`, `MessageService`, `PhoneNumberService`,
  `QrCodeService`, `TemplateService`) covering the official WhatsApp Cloud API Postman collection.
- `WebhookVerifier` for validating the Meta webhook subscription handshake and
  `X-Hub-Signature-256` signature, framework-agnostic.
- Configuration through constructor options or the `WHATSAPP_*` environment variables.
- ESM and CommonJS builds with TypeScript definitions; no runtime dependencies.
