import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  auth: { user: { role: 'admin', permissions: [] }, isAdmin: true, isAuthenticated: true },
  pathname: '/admin',
  search: '',
  setSearchParams: vi.fn(),
  navigate: vi.fn(),
  workflow: {
    pagination: { totalCount: 3 },
    claimedItems: [{ id: 1 }, { id: 2 }],
    fetchPendingSubmissions: vi.fn(),
    fetchClaimedItems: vi.fn(),
  },
  getPins: vi.fn(),
  savePins: vi.fn(),
  resetPins: vi.fn(),
  unreadCount: 7,
}));

vi.mock('react-router-dom', () => ({
  useLocation: () => ({ pathname: mocks.pathname }),
  useSearchParams: () => [new URLSearchParams(mocks.search), mocks.setSearchParams],
  useNavigate: () => mocks.navigate,
}));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => mocks.auth }));
vi.mock('../../store/submissionWorkflowStore', () => ({ default: () => mocks.workflow }));
vi.mock('../useUnreadMessages', () => ({
  useUnreadMessages: () => ({ unreadCount: mocks.unreadCount }),
  default: () => ({ unreadCount: mocks.unreadCount }),
}));
vi.mock('../../services/admin/navPinsService', async (importOriginal) => {
  const original = await importOriginal();
  return {
    ...original,
    navPinsService: {
      getPins: mocks.getPins,
      savePins: mocks.savePins,
      resetPins: mocks.resetPins,
    },
  };
});

import { renderHook } from './testUtils/renderHook';
import { useAdminNavigation } from './useAdminNavigation';

const loadedPins = (pins, defaults = ['my-work', 'submissions']) => ({
  pins,
  defaults,
  is_default: false,
});

const storage = new Map();

beforeEach(() => {
  storage.clear();
  vi.stubGlobal('localStorage', {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    clear: () => storage.clear(),
  });
  mocks.auth = { user: { role: 'admin', permissions: [] }, isAdmin: true, isAuthenticated: true };
  mocks.pathname = '/admin';
  mocks.search = '';
  mocks.setSearchParams.mockReset();
  mocks.navigate.mockReset();
  mocks.getPins.mockReset().mockResolvedValue(loadedPins(['my-work']));
  mocks.savePins.mockReset().mockImplementation(async (pins) => loadedPins(pins));
  mocks.resetPins.mockReset().mockResolvedValue(loadedPins(['my-work', 'submissions']));
});

afterEach(() => {
  storage.clear();
  vi.unstubAllGlobals();
});

describe('useAdminNavigation', () => {
  it('keeps only known and accessible saved pins visible and moves badge counts into the hook', async () => {
    mocks.auth = {
      user: { role: 'staff', permissions: ['manage_submissions'] },
      isAdmin: false,
      isAuthenticated: true,
    };
    mocks.getPins.mockResolvedValue(loadedPins(['unknown-page', 'users', 'needs-linking']));
    const hook = await renderHook(() => useAdminNavigation(), {});

    expect(hook.current.pins).toEqual(['unknown-page', 'users', 'needs-linking']);
    expect(hook.current.pinnedTabs.map(({ key }) => key)).toEqual(['needs-linking']);
    expect(hook.current.counts).toEqual({ 'my-work': 2, submissions: 3, mentions: 7 });
    hook.unmount();
  });

  it('saves pin and unpin actions in order and resets through DELETE', async () => {
    const hook = await renderHook(() => useAdminNavigation(), {});

    await act(async () => hook.current.togglePin('submissions'));
    expect(mocks.savePins).toHaveBeenLastCalledWith(['my-work', 'submissions']);
    expect(hook.current.pins).toEqual(['my-work', 'submissions']);
    expect(hook.current.statusMessage).toBe('Submissions Queue pinned.');

    await act(async () => hook.current.togglePin('my-work'));
    expect(mocks.savePins).toHaveBeenLastCalledWith(['submissions']);
    expect(hook.current.pins).toEqual(['submissions']);

    await act(async () => hook.current.resetPins());
    expect(mocks.resetPins).toHaveBeenCalledOnce();
    expect(hook.current.pins).toEqual(['my-work', 'submissions']);
    hook.unmount();
  });

  it('uses API-resolved pins for first-time users and empty defaults', async () => {
    mocks.getPins.mockResolvedValueOnce({
      pins: ['resources'], is_default: true, defaults: ['my-work', 'submissions'],
    });
    const firstTimeHook = await renderHook(() => useAdminNavigation(), {});
    expect(firstTimeHook.current.pins).toEqual(['resources']);
    firstTimeHook.unmount();

    mocks.getPins.mockResolvedValueOnce({ pins: [], is_default: true, defaults: [] });
    const emptyHook = await renderHook(() => useAdminNavigation(), {});
    expect(emptyHook.current.pins).toEqual([]);
    expect(emptyHook.current.pinnedTabs).toEqual([]);
    emptyHook.unmount();
  });

  it('uses pins returned from save and reset responses', async () => {
    const hook = await renderHook(() => useAdminNavigation(), {});
    mocks.savePins.mockResolvedValueOnce({ pins: ['resources'], is_default: true, defaults: ['my-work'] });

    await act(async () => hook.current.togglePin('submissions'));

    expect(mocks.savePins).toHaveBeenCalledWith(['my-work', 'submissions']);
    expect(hook.current.pins).toEqual(['resources']);

    mocks.resetPins.mockResolvedValueOnce({ pins: [], is_default: true, defaults: [] });
    await act(async () => hook.current.resetPins());

    expect(mocks.resetPins).toHaveBeenCalledWith();
    expect(hook.current.pins).toEqual([]);
    hook.unmount();
  });

  it('blocks an eleventh pin and restores saved pins with a generic error on failure', async () => {
    const tenPins = Array.from({ length: 10 }, (_, index) => `pin-${index}`);
    mocks.getPins.mockResolvedValue(loadedPins(tenPins));
    const hook = await renderHook(() => useAdminNavigation(), {});

    expect(hook.current.isPinLimitReached).toBe(true);
    await act(async () => hook.current.togglePin('my-work'));
    expect(mocks.savePins).not.toHaveBeenCalled();

    mocks.getPins.mockResolvedValue(loadedPins(['my-work']));
    hook.unmount();
    const failedSaveHook = await renderHook(() => useAdminNavigation(), {});
    mocks.savePins.mockRejectedValueOnce(new Error('private server detail'));
    await act(async () => failedSaveHook.current.togglePin('submissions'));

    expect(failedSaveHook.current.pins).toEqual(['my-work']);
    expect(failedSaveHook.current.saveError).toBe('Could not save your pinned pages. Your previous pins were restored.');
    failedSaveHook.unmount();
  });

  it('defaults submission and electronic pages to collapsed and remembers each route family', async () => {
    mocks.pathname = '/admin/submissions/31';
    const submissionHook = await renderHook(() => useAdminNavigation(), {});

    expect(submissionHook.current.isCollapsed).toBe(true);
    await act(async () => submissionHook.current.setCollapsed(false));
    expect(storage.get('admin-navigation-submissions-collapsed')).toBe('false');
    submissionHook.unmount();

    const rememberedSubmissionHook = await renderHook(() => useAdminNavigation(), {});
    expect(rememberedSubmissionHook.current.isCollapsed).toBe(false);
    rememberedSubmissionHook.unmount();

    mocks.pathname = '/admin/electronic/500';
    const hook = await renderHook(() => useAdminNavigation(), {});

    expect(hook.current.isCollapsed).toBe(true);
    await act(async () => hook.current.setCollapsed(false));
    expect(storage.get('admin-navigation-electronic-collapsed')).toBe('false');
    hook.unmount();

    mocks.pathname = '/admin';
    const regularHook = await renderHook(() => useAdminNavigation(), {});
    expect(regularHook.current.isCollapsed).toBe(false);
    await act(async () => regularHook.current.setCollapsed(true));
    expect(storage.get('admin-navigation-collapsed')).toBe('true');
    regularHook.unmount();
  });

  it('remains usable when localStorage reads and writes throw', async () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('storage disabled'); },
      setItem: () => { throw new Error('storage disabled'); },
    });
    const hook = await renderHook(() => useAdminNavigation(), {});

    expect(hook.current.isCollapsed).toBe(false);
    await act(async () => hook.current.setCollapsed(true));
    expect(hook.current.isCollapsed).toBe(true);
    hook.unmount();
  });

  it('uses My Work Queue unless a valid deep-link tab is requested', async () => {
    const hook = await renderHook(() => useAdminNavigation(), {});
    expect(hook.current.activeTab).toBe('my-work');
    hook.unmount();

    mocks.search = 'tab=resources';
    const deepLinkHook = await renderHook(() => useAdminNavigation(), {});
    expect(deepLinkHook.current.activeTab).toBe('resources');
    deepLinkHook.unmount();
  });

  it('redirects an unauthorized tab query to the first page the person can open', async () => {
    mocks.auth = {
      user: { role: 'employee', permissions: ['view_reports'] },
      isAdmin: false,
      isAuthenticated: true,
    };
    mocks.search = 'tab=users';
    const hook = await renderHook(() => useAdminNavigation(), {});

    expect(hook.current.activeTab).toBe('tracking');
    expect(mocks.setSearchParams).toHaveBeenCalledWith(expect.any(URLSearchParams), { replace: true });
    expect(mocks.setSearchParams.mock.calls[0][0].get('tab')).toBe('tracking');
    hook.unmount();
  });
});
