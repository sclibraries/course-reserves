import { describe, expect, it } from 'vitest';
import { formatSubmissionDetail } from './submissionDetailFormatter';

describe('formatSubmissionDetail EDS fields', () => {
  it('keeps structured identifiers and EDS record identity on staff items', () => {
    const resourceData = {
      title: 'Synthetic Article',
      doi: '10.1000/cx028',
      issn: '1234-5678',
      journalTitle: 'Synthetic Journal',
      volume: '12',
      issue: '3',
      eds: {
        dbId: 'synthetic-database',
        an: 'synthetic-an',
        plink: 'https://search.ebscohost.com/record/synthetic-cx028',
      },
    };
    const result = formatSubmissionDetail({
      newResources: [{
        id: 28,
        resource_data: JSON.stringify(resourceData),
        item_status: 'pending',
        display_order: 0,
      }],
      communications: [],
    });

    expect(result.unfolderedItems[0]).toMatchObject({
      doi: '10.1000/cx028',
      issn: '1234-5678',
      journalTitle: 'Synthetic Journal',
      volume: '12',
      issue: '3',
      eds: resourceData.eds,
    });
  });
});
