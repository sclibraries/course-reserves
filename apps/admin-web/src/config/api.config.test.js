import { describe, expect, it } from 'vitest';
import { apiConfig } from './api.config';

describe('apiConfig submission workflow endpoints', () => {
  it('uses the routed item endpoint for item status updates', () => {
    expect(apiConfig.endpoints.submissionWorkflow.updateItemStatus).toBe(
      '/submission-workflow/item/:itemId'
    );
  });

  it('configures the staff item flow endpoints', () => {
    expect(apiConfig.endpoints.workflowFlows).toEqual({
      itemFlow: '/workflow/item/:kind/:id/flow',
      stepResult: '/workflow/item/:kind/:id/step-result',
      switchFlow: '/workflow/item/:kind/:id/switch-flow',
      itemAccessPath: '/workflow/item/:kind/:id/access-path',
      flows: '/workflow/flows',
      adminFlows: '/workflow/admin/flows',
      accessPathMapping: '/workflow/admin/access-path-mapping',
    });
  });
});

describe('apiConfig search endpoints', () => {
  it('provides configured paths for FOLIO inventory and course-reserves searches', () => {
    expect(apiConfig.endpoints.folioSearch.inventory).toBe('/search/search-inventory');
    expect(apiConfig.endpoints.courseReserves.hitchcockSearch).toBe(
      '/hitchcock/search-resources'
    );
    expect(apiConfig.endpoints.courseReserves.materialTypes).toEqual({
      all: '/material-type/all',
      fields: '/material-type/fields',
    });
  });
});
