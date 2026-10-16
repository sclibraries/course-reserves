import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let useReserveStore: typeof import('../useReserveStore').useReserveStore;

describe('submission roster course matching after reload', () => {
  const itsCourseId = 'BIO-101-01-202702';

  beforeEach(async () => {
    vi.stubGlobal('localStorage', makeLocalStorageMock());
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [{
          submission_uuid: 'submission-test-1',
          its_course_id: itsCourseId,
          academic_period: 'AP_202702',
          course_code: 'BIO 101',
          course_title: 'Synthetic Biology',
          section: '01',
          faculty_display_name: 'Test Faculty',
          term_code: 'Spring 2027',
          status: 'submitted',
          updated_at: '2026-08-01T12:00:00Z',
        }],
      }),
    }));
    vi.resetModules();
    ({ useReserveStore } = await import('../useReserveStore'));
    useReserveStore.setState({ reserves: [] });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('matches the mocked index submission to its exact ITS roster course', async () => {
    await useReserveStore.getState().fetchSubmissions();

    const matchedSubmission = useReserveStore.getState().findReserveByAssignmentId(itsCourseId);

    expect(matchedSubmission).toMatchObject({
      id: 'submission-test-1',
      courseAssignmentId: itsCourseId,
      academicPeriod: 'AP_202702',
      status: 'submitted',
    });
  });
});

function makeLocalStorageMock() {
  const values: Record<string, string> = {};
  return {
    getItem: (key: string) => values[key] ?? null,
    setItem: (key: string, value: string) => { values[key] = String(value); },
    removeItem: (key: string) => { delete values[key]; },
    clear: () => { Object.keys(values).forEach((key) => delete values[key]); },
    key: (index: number) => Object.keys(values)[index] ?? null,
    get length() { return Object.keys(values).length; },
  };
}
