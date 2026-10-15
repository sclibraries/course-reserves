import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let useActingForStore: typeof import('./actingForStore').useActingForStore;
let useAuthStore: typeof import('./authStore').useAuthStore;

describe('actingForStore', () => {
  beforeEach(async () => {
    vi.stubGlobal('localStorage', makeStorage());
    vi.stubGlobal('sessionStorage', makeStorage());
    vi.resetModules();
    ({ useActingForStore } = await import('./actingForStore'));
    ({ useAuthStore } = await import('./authStore'));
  });

  afterEach(() => {
    useActingForStore.getState().clearSelection();
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('persists only the selected faculty username and display name', () => {
    useActingForStore.getState().selectFaculty({
      username: 'test-faculty',
      displayName: 'Test Faculty',
    });

    const persisted = JSON.parse(localStorage.getItem('acting-for-selection') || '{}');
    expect(persisted.state).toEqual({
      selectedFaculty: { username: 'test-faculty', displayName: 'Test Faculty' },
    });
  });

  it('clears the selected faculty on logout', () => {
    useActingForStore.getState().selectFaculty({
      username: 'test-faculty',
      displayName: 'Test Faculty',
    });
    useAuthStore.getState().logout();

    expect(useActingForStore.getState().selectedFaculty).toBeNull();
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
