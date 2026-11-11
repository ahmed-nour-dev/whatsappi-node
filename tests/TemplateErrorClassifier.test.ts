import { describe, expect, it } from 'vitest';
import { CloudApiClient, TemplateService } from '../src/index.js';

const templates = new TemplateService(new CloudApiClient());

describe('template error classifiers', () => {
  it('detects a duplicate language error by subcode', () => {
    const result = { success: false, data: { error: { error_subcode: 2388024 } }, error: null, status: 400 };

    expect(templates.isDuplicateLanguageError(result)).toBe(true);
    expect(templates.isLanguageDeletionError(result)).toBe(false);
    expect(templates.isCategoryMismatchError(result)).toBe(false);
  });

  it('detects a language deletion error by message', () => {
    const result = { success: false, data: {}, error: 'Message template language is being deleted', status: 400 };

    expect(templates.isLanguageDeletionError(result)).toBe(true);
  });

  it('detects a category mismatch error by subcode', () => {
    const result = { success: false, data: { error: { error_subcode: 2388026 } }, error: null, status: 400 };

    expect(templates.isCategoryMismatchError(result)).toBe(true);
  });

  it('appends a _v2 suffix to an unversioned name', () => {
    expect(templates.nextTemplateName('sample_request')).toBe('sample_request_v2');
  });

  it('increments an existing version suffix', () => {
    expect(templates.nextTemplateName('sample_request_v2')).toBe('sample_request_v3');
    expect(templates.nextTemplateName('sample_request_v9')).toBe('sample_request_v10');
  });
});
