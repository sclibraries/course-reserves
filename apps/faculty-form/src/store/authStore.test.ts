import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  notifyModule: {
    notify: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
  },
}));

vi.mock('@/services/notify', () => mocks.notifyModule);

const now = 1_800_000_000;

const tokenFor = (username: string, exp = now + 3600, internalId = 'test-id-123') => {
  const encode = (value: string) => btoa(value).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const claims = {
    username,
    role: 'faculty',
    id: username,
    full_name: username === 'test-faculty-a' ? 'Test Faculty A' : 'Test Faculty B',
    email: `${username}@example.edu`,
    institution: 'SM',
    internal_id: internalId,
    iat: now - 30,
    exp,
  };
  return `${encode('{"alg":"none"}')}.${encode(JSON.stringify(claims))}.synthetic-signature`;
};

const envelope = (state: Record<string, unknown>, version = 0) => JSON.stringify({ state, version });

const createStoredFormData = (owner?: string) => {
  const stamp = owner === undefined ? {} : { ownerUsername: owner };
  const assignment = { assignment: { course_id: 'TEST-101', smith_id: 'test-faculty-a' } };
  return {
    'course-reserves-storage': { reserves: [{ id: 'reserve-a' }], _initialized: true, ...stamp },
    'course-assignments-storage': {
      assignments: [assignment], actingForAssignments: [assignment], actingForCanEdit: true, ...stamp,
    },
    'draft-storage': {
      drafts: { 'reserve-a': { uuid: 'reserve-a' } },
      savingStatus: {}, lastSaveTime: {}, saveErrors: {}, hasUnsavedChanges: { 'reserve-a': true }, ...stamp,
    },
    'acting-for-selection': { selectedFaculty: { username: 'test-faculty-a', displayName: 'Test Faculty A' }, ...stamp },
  };
};

const loadStores = async () => {
  const { FACULTY_FORM_AUTH_PATH, useAuthStore } = await import('./authStore');
  const { useReserveStore } = await import('./useReserveStore');
  const { useDraftStore } = await import('./draftStore');
  const { useCourseAssignmentsStore } = await import('./courseAssignmentsStore');
  const { useActingForStore } = await import('./actingForStore');
  return { FACULTY_FORM_AUTH_PATH, useAuthStore, useReserveStore, useDraftStore, useCourseAssignmentsStore, useActingForStore };
};

describe('authStore session lifecycle', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', makeStorage());
    vi.stubGlobal('fetch', vi.fn());
    localStorage.clear();
    sessionStorage.clear();
    document.cookie = 'accessToken=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT';
    mocks.notifyModule.notify.success.mockReset();
    mocks.notifyModule.notify.error.mockReset();
    mocks.notifyModule.notify.info.mockReset();
    vi.resetModules();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('initializes signed out and undecided before startup reads the cookie', async () => {
    const { useAuthStore } = await loadStores();

    expect(useAuthStore.getState()).toMatchObject({
      user: null,
      isAuthenticated: false,
      loading: false,
      initialized: false,
      error: null,
    });
  });

  it('initializes from cookie claims without a persisted user', async () => {
    document.cookie = `accessToken=${encodeURIComponent(tokenFor('test-faculty-a'))}; Path=/`;
    const { useAuthStore } = await loadStores();

    useAuthStore.getState().initializeFromCookie();

    expect(useAuthStore.getState()).toMatchObject({
      user: {
        username: 'test-faculty-a',
        role: 'faculty',
        full_name: 'Test Faculty A',
        internal_id: 'test-id-123',
        exp: now + 3600,
      },
      isAuthenticated: true,
      initialized: true,
    });
  });

  it.each([
    ['retains data for the same stamped user', 'test-faculty-a', 'test-faculty-a', true],
    ['clears another user’s data from storage and memory', 'test-faculty-a', 'test-faculty-b', false],
    ['clears unstamped legacy data from storage and memory', undefined, 'test-faculty-b', false],
  ])('%s', async (_name, owner, cookieUser, keepData) => {
    for (const [key, state] of Object.entries(createStoredFormData(owner))) {
      localStorage.setItem(key, envelope(state, key === 'course-reserves-storage' ? 1 : 0));
    }
    localStorage.setItem('auth-store', envelope({
      user: { username: 'test-faculty-a', role: 'faculty', full_name: 'Old User', exp: now + 3600 },
      isAuthenticated: true,
    }));
    document.cookie = `accessToken=${encodeURIComponent(tokenFor(cookieUser))}; Path=/`;

    const stores = await loadStores();
    stores.useAuthStore.getState().initializeFromCookie();

    expect(stores.useAuthStore.getState().user?.username).toBe(cookieUser);
    expect(stores.useAuthStore.getState().isAuthenticated).toBe(true);
    expect(stores.useReserveStore.getState().reserves).toHaveLength(keepData ? 1 : 0);
    expect(stores.useCourseAssignmentsStore.getState().assignments).toHaveLength(keepData ? 1 : 0);
    expect(stores.useCourseAssignmentsStore.getState().actingForAssignments).toHaveLength(keepData ? 1 : 0);
    expect(Object.keys(stores.useDraftStore.getState().drafts)).toHaveLength(keepData ? 1 : 0);
    expect(stores.useActingForStore.getState().selectedFaculty).toEqual(
      keepData ? { username: 'test-faculty-a', displayName: 'Test Faculty A' } : null,
    );
    for (const [key] of Object.entries(createStoredFormData(owner))) {
      const state = JSON.parse(localStorage.getItem(key) || '{}').state;
      expect(state.ownerUsername).toBe(cookieUser);
      if (key === 'course-reserves-storage') {
        expect(state.reserves).toEqual(keepData ? [{ id: 'reserve-a' }] : []);
      } else if (key === 'course-assignments-storage') {
        expect(state.assignments).toHaveLength(keepData ? 1 : 0);
        expect(state.actingForAssignments).toHaveLength(keepData ? 1 : 0);
      } else if (key === 'draft-storage') {
        expect(state.drafts).toEqual(keepData ? { 'reserve-a': { uuid: 'reserve-a' } } : {});
      } else {
        expect(state.selectedFaculty).toEqual(
          keepData ? { username: 'test-faculty-a', displayName: 'Test Faculty A' } : null,
        );
      }
    }
  });

  it('rejects persisted authentication and clears stored form data when the cookie is absent', async () => {
    for (const [key, state] of Object.entries(createStoredFormData('test-faculty-a'))) {
      localStorage.setItem(key, envelope(state, key === 'course-reserves-storage' ? 1 : 0));
    }
    localStorage.setItem('auth-store', envelope({
      user: { username: 'test-faculty-a', role: 'faculty', full_name: 'Test Faculty A', exp: now + 3600 },
      isAuthenticated: true,
    }));
    const { useAuthStore, useReserveStore, useDraftStore, useCourseAssignmentsStore, useActingForStore } = await loadStores();

    useAuthStore.getState().initializeFromCookie();

    expect(useAuthStore.getState()).toMatchObject({ user: null, isAuthenticated: false, initialized: true });
    expect(useReserveStore.getState().reserves).toEqual([]);
    expect(useDraftStore.getState().drafts).toEqual({});
    expect(useCourseAssignmentsStore.getState().assignments).toEqual([]);
    expect(useCourseAssignmentsStore.getState().actingForAssignments).toEqual([]);
    expect(useActingForStore.getState().selectedFaculty).toBeNull();
    expect(localStorage.getItem('course-reserves-storage')).toBeNull();
    expect(localStorage.getItem('course-assignments-storage')).toBeNull();
    expect(localStorage.getItem('draft-storage')).toBeNull();
    expect(localStorage.getItem('acting-for-selection')).toBeNull();
  });

  it('keeps the mock login token, derives its expiry from claims, and reports success', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(now * 1000);
    const token = tokenFor('test-faculty-a', now + 1234);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        token,
        user: { username: 'wrong-user', role: 'wrong-role' },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const cookie = vi.spyOn(document, 'cookie', 'set');
    const { useAuthStore } = await loadStores();

    await useAuthStore.getState().setMockUser('Test Faculty A', 'test-id-123');

    const [, options] = fetchMock.mock.calls[0] as [RequestInfo | URL, RequestInit];
    expect(JSON.parse(String(options.body))).toEqual({
      full_name: 'Test Faculty A', institution: 'SM', role: 'faculty', internal_id: 'test-id-123',
    });
    expect(cookie.mock.calls[0]?.[0]).toContain('Max-Age=1234');
    expect(useAuthStore.getState()).toMatchObject({
      user: { username: 'test-faculty-a', role: 'faculty', exp: now + 1234 },
      isAuthenticated: true,
      initialized: true,
    });
  });

  it('clears every in-memory store and gives app-only sign-out feedback', async () => {
    vi.stubEnv('VITE_BASE_PATH', '/form/');
    document.cookie = `accessToken=${encodeURIComponent(tokenFor('test-faculty-a'))}; Path=/`;
    const stores = await loadStores();
    stores.useAuthStore.getState().initializeFromCookie();
    stores.useReserveStore.setState({ reserves: [{ id: 'reserve-a' }] as never });
    stores.useDraftStore.setState({ drafts: { 'reserve-a': { uuid: 'reserve-a' } } as never });
    stores.useCourseAssignmentsStore.setState({
      assignments: [{ assignment: { course_id: 'TEST-101' } }] as never,
      actingForAssignments: [{ assignment: { course_id: 'TEST-201' } }] as never,
    });
    stores.useActingForStore.getState().selectFaculty({ username: 'test-faculty-b', displayName: 'Test Faculty B' });
    sessionStorage.setItem('faculty-form-return-destination', '/form/submission/reserve-a');

    stores.useAuthStore.getState().logout();

    expect(stores.useReserveStore.getState().reserves).toEqual([]);
    expect(stores.useDraftStore.getState().drafts).toEqual({});
    expect(stores.useCourseAssignmentsStore.getState()).toMatchObject({ assignments: [], actingForAssignments: [] });
    expect(stores.useActingForStore.getState().selectedFaculty).toBeNull();
    expect(stores.useAuthStore.getState()).toMatchObject({ user: null, isAuthenticated: false });
    expect(localStorage.getItem('course-reserves-storage')).toBeNull();
    expect(localStorage.getItem('course-assignments-storage')).toBeNull();
    expect(localStorage.getItem('draft-storage')).toBeNull();
    expect(localStorage.getItem('acting-for-selection')).toBeNull();
    expect(sessionStorage.getItem('faculty-form-return-destination')).toBeNull();
    expect(mocks.notifyModule.notify.success).toHaveBeenCalledWith(
      'Signed out of Course Reserves. Close the browser to end your campus sign-in.',
    );
    expect(stores.FACULTY_FORM_AUTH_PATH).toBe('/form/auth');
  });
});

function makeStorage() {
  const values: Record<string, string> = {};
  return {
    getItem: (key: string) => values[key] ?? null,
    setItem: (key: string, value: string) => { values[key] = String(value); },
    removeItem: (key: string) => { delete values[key]; },
    clear: () => { Object.keys(values).forEach((key) => delete values[key]); },
  };
}
