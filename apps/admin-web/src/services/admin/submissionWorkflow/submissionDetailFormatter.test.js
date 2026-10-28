import { describe, expect, it } from 'vitest';
import { formatSubmissionDetail } from './submissionDetailFormatter';

describe('formatSubmissionDetail EDS fields', () => {
  it('uses the faculty username when the display name is missing', () => {
    const result = formatSubmissionDetail({
      faculty_display_name: '',
      shibboleth_user_id: 'test-faculty-a',
      newResources: [],
      communications: [],
    });

    expect(result.submission.facultyName).toBe('test-faculty-a');
  });

  it('preserves readiness and flow summaries from the submission detail', () => {
    const flow = {
      name: 'Synthetic purchase flow',
      current_step_label: 'Request purchase',
      finish_state: null,
    };
    const result = formatSubmissionDetail({
      newResources: [{
        id: 99907831,
        resource_data: '{"title":"Synthetic item"}',
        readiness: 'missing',
        readiness_reason: 'No Five College copy found',
        flow,
      }],
      communications: [],
    });

    expect(result.unfolderedItems[0]).toMatchObject({
      readiness: 'missing',
      readinessReason: 'No Five College copy found',
      flow,
    });
  });

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

  it('keeps claims contract state and faculty position on staff items', () => {
    const result = formatSubmissionDetail({
      submission_id: 54,
      submission_uuid: 'synthetic-api078-submission',
      newResources: [{
        id: 99907811,
        resource_data: JSON.stringify({ title: 'Synthetic item', materialType: 'book' }),
        item_status: 'pending',
        position: 2,
        claimed_by: 'test-api078-owner',
        claimed_by_display: 'Test Owner',
        claimed_at: '2026-10-19T11:00:00Z',
        last_activity_at: '2026-10-19T12:00:00Z',
        expires_at: '2026-10-22T12:00:00Z',
        assigned_group: { id: 4, name: 'Acquisitions' },
        access_path: 'purchase',
        allowed_access_paths: ['purchase', 'faculty_supplies'],
      }],
      communications: [],
    });

    expect(result.unfolderedItems[0]).toMatchObject({
      claimPosition: 2,
      claimedByUsername: 'test-api078-owner',
      claimedByDisplay: 'Test Owner',
      claimedAt: '2026-10-19T11:00:00Z',
      lastActivityAt: '2026-10-19T12:00:00Z',
      expiresAt: '2026-10-22T12:00:00Z',
      assignedGroup: { id: 4, name: 'Acquisitions' },
      accessPath: 'purchase',
      allowedAccessPaths: ['purchase', 'faculty_supplies'],
    });
  });

  it('derives the item reference kind from the detail resource collection', () => {
    const result = formatSubmissionDetail({
      newResources: [{ id: 99907821, resource_data: '{"title":"New item"}', display_order: 1 }],
      reuseResources: [{ id: 99907822, resource_data: '{"title":"Reused item"}', display_order: 2 }],
      communications: [],
    });

    expect(result.unfolderedItems.find((item) => item.id === 99907821).isReuse).toBe(false);
    expect(result.unfolderedItems.find((item) => item.id === 99907822).isReuse).toBe(true);
  });
});
