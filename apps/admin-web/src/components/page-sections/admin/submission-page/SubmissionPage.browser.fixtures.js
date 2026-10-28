export const longUrl = `https://example.test/${'x'.repeat(179)}`;
export const longTitle = `Synthetic reserve reading ${'with descriptive words '.repeat(8)}${'unbroken'.repeat(10)}`;
export const longClaim = `Synthetic staff member ${'with a long display name '.repeat(5)}`;
const makeItem = (id, title, overrides = {}) => ({
  id, kind: 'new', title, authors: 'Synthetic Author', materialType: 'Book',
  eds: { plink: longUrl }, status: 'pending', readiness: 'ready',
  readinessReason: 'Synthetic catalog record found.',
  flow: { name: 'Purchase workflow', current_step_label: 'Request purchase', finish_state: null },
  claimed_by: null, claimed_by_display: null, displayOrder: 1, positionInFolder: 1,
  ...overrides,
});

export const screenshotFolders = [
  {
    name: 'Core readings',
    items: [
      makeItem('test-item-1', 'The Glass Orchard', {
        readiness: 'missing', readinessReason: 'No synthetic catalog match was found.',
        claimed_by: 'devadmin', claimed_by_display: 'Synthetic Admin',
      }),
      makeItem('test-item-2', 'A Map of Quiet Places', {
        readiness: 'in_progress', claimed_by: 'synthetic-staff', claimed_by_display: 'Synthetic Staff Member',
      }),
    ],
  },
  {
    name: 'Further reading',
    items: [makeItem('test-item-3', 'History of the Blue River', { readiness: 'missing' })],
  },
];

export const longTitleFolders = [{
  name: 'Core readings',
  items: [
    screenshotFolders[0].items[0],
    makeItem('test-long-title', longTitle, {
      claimed_by: 'synthetic-long-staff', claimed_by_display: longClaim,
    }),
  ],
}];
