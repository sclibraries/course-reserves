import { describe, expect, it } from 'vitest';
import { buildCorrectionSummary, parseCorrectionRequired } from './submissionUpdateErrors';

const attemptedUpdate = {
  items: [
    {
      item_uuid: '259',
      title: 'Climate and Society',
      author: 'A. Researcher',
      material_type: 'book',
      publisher: 'Example Press',
      url: null,
    },
  ],
};

const responseFor = (status: number, body: string) =>
  new Response(body, { status, headers: { 'Content-Type': 'application/json' } });

describe('parseCorrectionRequired', () => {
  it('parses the API-033 contract and keeps the original attempted update', async () => {
    const response = responseFor(409, JSON.stringify({
      success: false,
      error_code: 'materialized_item_correction_required',
      message: 'Processed course-reserve items must be corrected by library staff.',
      submission_uuid: 'submission-uuid',
      item_ids: [259],
    }));

    await expect(parseCorrectionRequired(response, attemptedUpdate)).resolves.toEqual({
      submissionUuid: 'submission-uuid',
      itemIds: [259],
      attemptedUpdate,
    });
  });

  it('does not classify an unrelated 409 as a correction request', async () => {
    const response = responseFor(409, JSON.stringify({
      error_code: 'submission_conflict',
      submission_uuid: 'submission-uuid',
      item_ids: [259],
    }));

    await expect(parseCorrectionRequired(response, attemptedUpdate)).resolves.toBeNull();
  });

  it('requires the correction error code to come with HTTP 409', async () => {
    const response = responseFor(400, JSON.stringify({
      error_code: 'materialized_item_correction_required',
      submission_uuid: 'submission-uuid',
      item_ids: [259],
    }));

    await expect(parseCorrectionRequired(response, attemptedUpdate)).resolves.toBeNull();
  });

  it('treats malformed JSON as an ordinary response error', async () => {
    await expect(parseCorrectionRequired(responseFor(409, '{'), attemptedUpdate)).resolves.toBeNull();
  });

  it('summarizes affected titles and proposed fields without serializing the payload', async () => {
    const detail = await parseCorrectionRequired(responseFor(409, JSON.stringify({
      error_code: 'materialized_item_correction_required',
      submission_uuid: 'submission-uuid',
      item_ids: [259],
    })), attemptedUpdate);

    expect(detail).not.toBeNull();
    const summary = buildCorrectionSummary(detail!);
    expect(summary).toContain('Climate and Society');
    expect(summary).toContain('259');
    expect(summary).toContain('author');
    expect(summary).toContain('publisher');
    expect(summary).not.toContain('"item_uuid"');
    expect(summary).not.toContain('submission-uuid');
  });
});
