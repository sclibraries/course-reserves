import { describe, expect, it } from 'vitest';
import { apiConfig } from './api.config';

describe('apiConfig submission workflow endpoints', () => {
  it('uses the routed item endpoint for item status updates', () => {
    expect(apiConfig.endpoints.submissionWorkflow.updateItemStatus).toBe(
      '/submission-workflow/item/:itemId'
    );
  });
});
