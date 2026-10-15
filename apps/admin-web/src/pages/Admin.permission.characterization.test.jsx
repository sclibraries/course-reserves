import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  auth: { user: { role: 'faculty', permissions: [] }, isAdmin: false },
  initialTab: 'courses',
  navigate: vi.fn(),
  setSearchParams: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mocks.navigate,
  useSearchParams: () => [new URLSearchParams(`tab=${mocks.initialTab}`), mocks.setSearchParams],
}));

vi.mock('../contexts/AuthContext', () => ({ useAuth: () => mocks.auth }));
vi.mock('../config/api.config', () => ({ apiConfig: { environment: 'development' } }));
vi.mock('../store/adminSearchStore', () => ({
  default: () => ({
    college: '', type: '', query: '', department: '', termId: '', defaultsSet: true,
    fetchTerms: vi.fn(), initializeDefaults: vi.fn(),
  }),
}));
vi.mock('../store', () => ({
  default: () => ({ fetchResults: vi.fn(), results: [], error: null, loading: false }),
}));
vi.mock('../store/resourceSearchStore', () => ({
  default: () => ({
    results: [], pagination: {}, error: null, loading: false, setSearchResults: vi.fn(),
  }),
}));
vi.mock('../store/submissionWorkflowStore', () => ({
  default: () => ({
    pagination: {}, claimedItems: [], fetchPendingSubmissions: vi.fn(), fetchClaimedItems: vi.fn(),
  }),
}));
vi.mock('../hooks/useUnreadMessages', () => ({ default: () => ({ unreadCount: 0 }) }));
vi.mock('../hooks/useBuildQuery', () => ({ useBuildQuery: () => '' }));
vi.mock('../hooks/useCurrentTermId', () => ({ useCurrentTermId: () => ({ termId: null, loading: false }) }));
vi.mock('../services/admin/adminResourceService', () => ({
  adminResourceService: { getAllResources: vi.fn() },
}));

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

async function renderAdmin({ role, permissions, isAdmin, tab }) {
  mocks.auth = { user: { role, permissions }, isAdmin };
  mocks.initialTab = tab;
  mocks.navigate.mockClear();
  mocks.setSearchParams.mockClear();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);

  await act(async () => {
    root.render(<Admin />);
  });
}

afterEach(() => {
  if (root) {
    act(() => root.unmount());
    root = null;
  }
  container?.remove();
  container = null;
});

describe('Admin permission characterization before tab extraction', () => {
  it('shows the existing admin tabs', async () => {
    await renderAdmin({ role: 'admin', permissions: [], isAdmin: true, tab: 'courses' });

    expect(container.querySelector('[aria-label="Course Management Tab"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Resource Management Tab"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Workflow Management"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Tracking Reports Tab"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Workflow Templates Tab"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Customizations Tab"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="User Management Tab"]')).not.toBeNull();
  });

  it('lets staff with submission permission use workflow tabs and redirects away from users', async () => {
    await renderAdmin({
      role: 'staff', permissions: ['manage_submissions'], isAdmin: false, tab: 'users',
    });

    expect(container.querySelector('[aria-label="Workflow Management"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="User Management Tab"]')).toBeNull();
    expect(container.textContent).toContain('Submission queue content');
    expect(mocks.setSearchParams).toHaveBeenCalledWith({ tab: 'submissions' });
  });

  it('limits non-staff to their permitted tabs and redirects to Reports', async () => {
    await renderAdmin({
      role: 'faculty', permissions: ['view_reports'], isAdmin: false, tab: 'users',
    });

    expect(container.querySelector('[aria-label="Tracking Reports Tab"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Workflow Management"]')).toBeNull();
    expect(container.querySelector('[aria-label="User Management Tab"]')).toBeNull();
    expect(container.textContent).toContain('Reports content');
    expect(mocks.setSearchParams).toHaveBeenCalledWith({ tab: 'tracking' });
  });
});
