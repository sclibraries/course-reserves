import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  auth: { user: { role: 'employee', permissions: [] }, isAdmin: false },
  navigate: vi.fn(),
  setSearchParams: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mocks.navigate,
  useSearchParams: () => [new URLSearchParams('tab=courses'), mocks.setSearchParams],
}));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => mocks.auth }));
vi.mock('../config/api.config', () => ({ apiConfig: { environment: 'development' } }));
vi.mock('../store/adminSearchStore', () => ({
  default: () => ({ fetchTerms: vi.fn(), initializeDefaults: vi.fn(), defaultsSet: true }),
}));
vi.mock('../store', () => ({
  default: () => ({ fetchResults: vi.fn(), results: [], error: null, loading: false }),
}));
vi.mock('../store/resourceSearchStore', () => ({
  default: () => ({ results: [], pagination: {}, error: null, loading: false, setSearchResults: vi.fn() }),
}));
vi.mock('../store/submissionWorkflowStore', () => ({
  default: () => ({ pagination: {}, claimedItems: [], fetchPendingSubmissions: vi.fn(), fetchClaimedItems: vi.fn() }),
}));
vi.mock('../hooks/useUnreadMessages', () => ({ default: () => ({ unreadCount: 0 }) }));
vi.mock('../hooks/useBuildQuery', () => ({ useBuildQuery: () => '' }));
vi.mock('../hooks/useCurrentTermId', () => ({ useCurrentTermId: () => ({ termId: null, loading: false }) }));
vi.mock('../services/admin/adminResourceService', () => ({ adminResourceService: { getAllResources: vi.fn() } }));
vi.mock('../components/layout/HorizontalAdminSidebar', () => ({ default: () => <div>Course search</div> }));
vi.mock('../components/layout/HorizontalResourceSidebar', () => ({ default: () => <div>Resource search</div> }));
vi.mock('../components/page-sections/admin/AdminCourseList', () => ({ default: () => <div>Course list</div> }));
vi.mock('../components/page-sections/admin/ResourceListTable', () => ({ default: () => <div>Resource list</div> }));
vi.mock('../components/page-sections/admin/AdminCustomizations', () => ({ default: () => <div>Customizations content</div> }));
vi.mock('../components/page-sections/admin/UserManagement', () => ({ default: () => <div>User management content</div> }));
vi.mock('../components/page-sections/admin/ChecklistTemplateManager', () => ({ default: () => <div>Workflow templates content</div> }));
vi.mock('./TrackingReport', () => ({ default: () => <div>Reports content</div> }));
vi.mock('../components/page-sections/admin/SubmissionQueue', () => ({ default: () => <div>Submission queue content</div> }));
vi.mock('../components/page-sections/admin/MyWorkQueue', () => ({ default: () => <div>My work content</div> }));
vi.mock('../components/page-sections/admin/MyMentions', () => ({ default: () => <div>Mentions content</div> }));
vi.mock('../components/page-sections/admin/proxy-access/FacultyProxyAccess', () => ({
  default: () => <div>Proxy access content</div>,
}));

import Admin from './Admin';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;

async function renderAdmin(role, permissions = []) {
  mocks.auth = { user: { role, permissions }, isAdmin: role === 'admin' };
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root.render(<Admin />));
}

afterEach(() => {
  if (root) {
    act(() => root.unmount());
    root = null;
  }
  container?.remove();
  container = null;
});

describe('Admin proxy access tab visibility', () => {
  it('shows Proxy access for a staff role without other admin permissions', async () => {
    await renderAdmin('staff');

    expect(container.querySelector('[aria-label="Proxy Access Tab"]')).not.toBeNull();
    expect(container.textContent).toContain('Proxy access content');
    expect(mocks.setSearchParams).toHaveBeenCalledWith({ tab: 'proxy-access' });
  });

  it('shows Proxy access for an admin role', async () => {
    await renderAdmin('admin');

    expect(container.querySelector('[aria-label="Proxy Access Tab"]')).not.toBeNull();
  });

  it('does not show Proxy access to a non-staff user without submission permission', async () => {
    await renderAdmin('employee');

    expect(container.querySelector('[aria-label="Proxy Access Tab"]')).toBeNull();
    expect(container.textContent).toContain('Access Restricted');
  });

  it('does not show Proxy access when an employee has submission-management permission', async () => {
    await renderAdmin('employee', ['manage_submissions']);

    expect(container.querySelector('[aria-label="Proxy Access Tab"]')).toBeNull();
  });
});
