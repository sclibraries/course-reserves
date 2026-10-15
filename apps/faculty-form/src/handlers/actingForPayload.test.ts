import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let withActingForFaculty: typeof import('./actingForPayload').withActingForFaculty;
let useActingForStore: typeof import('@/store/actingForStore').useActingForStore;

describe('withActingForFaculty', () => {
  beforeEach(async () => {
    vi.stubGlobal('localStorage', makeStorage());
    vi.resetModules();
    ({ withActingForFaculty } = await import('./actingForPayload'));
    ({ useActingForStore } = await import('@/store/actingForStore'));
  });

  afterEach(() => {
    useActingForStore.getState().clearSelection();
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('adds the selected faculty username at the top level only while acting for them', () => {
    const payload = { reserveId: 'submission-test-1', metadata: { submittedBy: 'test-proxy' } };
    useActingForStore.getState().selectFaculty({ username: 'test-faculty', displayName: 'Test Faculty' });

    expect(withActingForFaculty(payload)).toEqual({
      ...payload,
      acting_for_faculty_id: 'test-faculty',
    });
  });

  it('leaves the owner submission payload unchanged when acting for nobody', () => {
    const payload = { reserveId: 'submission-test-1', metadata: { submittedBy: 'test-faculty' } };

    expect(withActingForFaculty(payload)).toEqual(payload);
  });
});

function makeStorage() {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
}
