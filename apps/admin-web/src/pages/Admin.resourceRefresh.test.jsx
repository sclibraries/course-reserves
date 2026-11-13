import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getByRole } from '@testing-library/dom';
import useResourceSearchStore from '../store/resourceSearchStore';
import Admin from './Admin';

const mocks = vi.hoisted(() => ({
  getAllResources: vi.fn(),
  fetchTerms: vi.fn(),
  initializeDefaults: vi.fn(),
  fetchResults: vi.fn(),
  outletContext: {
    activeTab: 'resources',
    hasAccess: true,
    tabRegistry: { tabs: [{ key: 'resources', canAccess: true }] },
  },
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useOutletContext: () => mocks.outletContext,
  };
});
vi.mock('../store/adminSearchStore', () => ({
  default: () => ({
    college: 'smith', type: 'all', query: '', department: '', termId: null,
    fetchTerms: mocks.fetchTerms, initializeDefaults: mocks.initializeDefaults, defaultsSet: true,
  }),
}));
vi.mock('../store', () => ({
  default: () => ({ fetchResults: mocks.fetchResults, results: [], error: null, loading: false }),
}));
vi.mock('../hooks/useBuildQuery', () => ({ useBuildQuery: () => '' }));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: { institution: 'Smith College' } }) }));
vi.mock('../hooks/useCurrentTermId', () => ({ useCurrentTermId: () => ({ termId: null, loading: true }) }));
vi.mock('../services/admin/adminResourceService', () => ({
  adminResourceService: { getAllResources: mocks.getAllResources },
}));
vi.mock('./adminTabRegistry', () => ({
  getAdminTab: () => ({ canAccess: true, renderContent: () => null }),
}));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;

beforeEach(() => {
  vi.clearAllMocks();
  useResourceSearchStore.setState({ error: null, results: [], pagination: {}, loading: false });
  mocks.getAllResources.mockRejectedValue(new Error('Synthetic resource service failure'));
});

afterEach(() => {
  if (root) act(() => root.unmount());
  root = null;
  container?.remove();
  container = null;
});

describe('Admin resource refresh feedback', () => {
  it('shows the existing alert when the resource refresh fails', async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root.render(createElement(Admin));
      await Promise.resolve();
    });

    expect(getByRole(container, 'alert').textContent).toBe("Couldn't load resources");
    expect(useResourceSearchStore.getState().error.message).toBe("Couldn't load resources");
  });
});
