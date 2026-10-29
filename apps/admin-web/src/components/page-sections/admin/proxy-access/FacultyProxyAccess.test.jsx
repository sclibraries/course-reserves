import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  listGrants: vi.fn(),
  getActivityLog: vi.fn(),
  revokeGrant: vi.fn(),
  notifySuccess: vi.fn(),
  notifyFromError: vi.fn(),
}));

vi.mock('../../../../services/admin/facultyProxyService', () => ({
  facultyProxyService: {
    listGrants: mocks.listGrants,
    getActivityLog: mocks.getActivityLog,
    revokeGrant: mocks.revokeGrant,
  },
}));
vi.mock('../../../../services/notify', () => ({
  notify: { success: mocks.notifySuccess, fromError: mocks.notifyFromError },
}));

import FacultyProxyAccess from './FacultyProxyAccess';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const grants = [
  {
    permission_id: 41,
    faculty_id: 'test-faculty-1',
    faculty_display_name: 'Test Faculty One',
    proxy_display_name: 'Test Proxy All',
    proxy_email: 'proxy-all@example.test',
    permission_type: 'full_access',
    scope_summary: 'Edit all courses',
    courses: [],
    status: 'active',
    invited_at: '2026-10-01T14:30:00Z',
    accepted_at: '2026-10-02T14:30:00Z',
    expires_at: null,
    invitation_expires_at: null,
  },
  {
    permission_id: 42,
    faculty_id: 'test-faculty-2',
    faculty_display_name: 'Test Faculty Two',
    proxy_display_name: 'Test Proxy Courses',
    proxy_email: 'proxy-courses@example.test',
    permission_type: 'specific_courses',
    scope_summary: 'Edit selected courses (1)',
    courses: [{ folio_course_listing_id: 'test-course-1', course_title: 'Test Course One', term_id: 'test-term' }],
    status: 'pending',
    invited_at: '2026-10-03T14:30:00Z',
    accepted_at: null,
    expires_at: null,
    invitation_expires_at: '2026-10-10T14:30:00Z',
  },
  {
    permission_id: 43,
    faculty_id: 'test-faculty-3',
    faculty_display_name: 'Test Faculty Three',
    proxy_display_name: 'Test Proxy View',
    proxy_email: 'proxy-view@example.test',
    permission_type: 'view_only',
    scope_summary: 'View all courses',
    courses: [],
    status: 'active',
    invited_at: '2026-10-04T14:30:00Z',
    accepted_at: '2026-10-05T14:30:00Z',
    expires_at: '2026-11-05T14:30:00Z',
    invitation_expires_at: null,
  },
];

const activity = [
  {
    log_id: 81,
    faculty_shibboleth_id: 'test-faculty-1',
    proxy_shibboleth_id: 'test-proxy-1',
    action: 'invited',
    created_at: '2026-10-06 14:45:00',
    details: { invited_by_user_id: 'test-staff-1', invited_by_role: 'staff', proxy_email: 'proxy@example.test' },
  },
  {
    log_id: 82,
    faculty_shibboleth_id: 'test-faculty-2',
    proxy_shibboleth_id: 'test-proxy-2',
    action: 'accepted',
    created_at: '2026-10-07 14:45:00',
    details: { accepted_by_user_id: 'test-proxy-2', accepted_by_role: 'employee' },
  },
  {
    log_id: 83,
    faculty_shibboleth_id: 'test-faculty-3',
    proxy_shibboleth_id: 'test-proxy-3',
    action: 'revoked',
    created_at: '2026-10-08 14:45:00',
    details: { revoked_by_user_id: 'test-admin-1', revoked_by_role: 'admin' },
  },
  {
    log_id: 84,
    faculty_shibboleth_id: 'test-faculty-1',
    proxy_shibboleth_id: 'test-proxy-1',
    action: 'acted_for',
    submission_id: 93,
    created_at: '2026-10-09 14:45:00',
    details: { folio_course_listing_id: 'test-course-1', course_title: 'Test Course One' },
  },
];

let container;
let root;

async function settle() {
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });
}

async function renderPage({ grantsReply = grants, activityReply = activity } = {}) {
  mocks.listGrants.mockReset().mockResolvedValue({ items: grantsReply, count: grantsReply.length });
  mocks.getActivityLog.mockReset().mockResolvedValue({ items: activityReply, count: activityReply.length });
  mocks.revokeGrant.mockReset().mockResolvedValue({ success: true, message: 'Proxy access revoked' });
  mocks.notifySuccess.mockReset();
  mocks.notifyFromError.mockReset();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);

  await act(async () => root.render(<FacultyProxyAccess />));
  await settle();
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  if (root) {
    act(() => root.unmount());
    root = null;
  }
  container?.remove();
  container = null;
  vi.restoreAllMocks();
});

describe('FacultyProxyAccess', () => {
  it('shows a loading state until grants and activity finish loading', async () => {
    let resolveGrants;
    let resolveActivity;
    mocks.listGrants.mockReset().mockReturnValue(new Promise((resolve) => { resolveGrants = resolve; }));
    mocks.getActivityLog.mockReset().mockReturnValue(new Promise((resolve) => { resolveActivity = resolve; }));
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => root.render(<FacultyProxyAccess />));
    expect(container.textContent).toContain('Loading faculty proxy access...');

    await act(async () => {
      resolveGrants({ items: grants, count: grants.length });
      resolveActivity({ items: activity, count: activity.length });
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Test Proxy All');
  });

  it('renders every grant scope, chosen courses, dates, and activity entries', async () => {
    await renderPage();

    expect(container.textContent).toContain('Test Proxy All');
    expect(container.textContent).toContain('Edit all courses');
    expect(container.textContent).toContain('Edit selected courses (1)');
    expect(container.textContent).toContain('Test Course One');
    expect(container.textContent).toContain('View all courses');
    expect(container.textContent).toContain('Test Faculty One');
    expect(container.textContent).toContain('10/1/2026');
    expect(container.textContent).toContain('invited');
    expect(container.textContent).toContain('accepted');
    expect(container.textContent).toContain('revoked');
    expect(container.textContent).toContain('acted for');
    expect(container.textContent).toContain('test-staff-1 · staff');
    expect(container.textContent).toContain('test-proxy-1');
    expect(container.textContent).toContain('test-course-1');
    const activityTime = container.querySelector('time[dateTime="2026-10-06 14:45:00"]');
    expect(activityTime.textContent).toBe(new Date(2026, 9, 6, 14, 45).toLocaleString());
    expect(activityTime.getAttribute('dateTime')).toBe('2026-10-06 14:45:00');
  });

  it('filters grants by status and faculty ID', async () => {
    await renderPage();
    const status = container.querySelector('[aria-label="Grant status filter"]');
    const faculty = container.querySelector('[aria-label="Faculty ID filter"]');

    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(status, 'pending');
      status.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await settle();
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(faculty, 'test-faculty-2');
      faculty.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await settle();

    expect(mocks.listGrants).toHaveBeenLastCalledWith({ status: 'pending', facultyId: 'test-faculty-2' });
    expect(mocks.getActivityLog).toHaveBeenLastCalledWith({ facultyId: 'test-faculty-2' });
  });

  it('shows empty and error states', async () => {
    await renderPage({ grantsReply: [], activityReply: [] });
    expect(container.textContent).toContain('No proxy grants found');
    expect(container.textContent).toContain('No proxy activity found');

    act(() => root.unmount());
    root = null;
    container.remove();
    container = null;
    mocks.listGrants.mockReset().mockRejectedValue(new Error('Staff lookup failed'));
    mocks.getActivityLog.mockReset().mockResolvedValue({ items: [], count: 0 });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root.render(<FacultyProxyAccess />));
    await settle();

    expect(container.textContent).toContain('Staff lookup failed');
    expect(container.textContent).toContain('Try again');
  });

  it('requires confirmation before revoking and refreshes the grants after success', async () => {
    await renderPage();
    const initialListCalls = mocks.listGrants.mock.calls.length;

    await act(async () => {
      container.querySelector('[aria-label="Revoke grant 41"]').click();
    });

    expect(document.body.textContent).toContain('Revoke faculty proxy access?');
    expect(mocks.revokeGrant).not.toHaveBeenCalled();

    await act(async () => {
      [...document.body.querySelectorAll('button')].find(button => button.textContent.includes('Revoke access')).click();
      await Promise.resolve();
    });
    await settle();

    expect(mocks.revokeGrant).toHaveBeenCalledWith(41);
    expect(mocks.listGrants.mock.calls.length).toBeGreaterThan(initialListCalls);
    expect(mocks.notifySuccess).toHaveBeenCalledWith('Proxy access revoked');
  });

  it('reports revoke failures with a generic message and the reference', async () => {
    await renderPage();
    mocks.revokeGrant.mockRejectedValueOnce(Object.assign(new Error('Synthetic provider detail'), {
      reference: 'SYNTH-REVOKE-1',
    }));
    await act(async () => {
      container.querySelector('[aria-label="Revoke grant 41"]').click();
    });
    await act(async () => {
      [...document.body.querySelectorAll('button')].find(button => button.textContent.includes('Revoke access')).click();
      await Promise.resolve();
    });

    expect(mocks.notifyFromError).toHaveBeenCalledWith(
      expect.objectContaining({ reference: 'SYNTH-REVOKE-1' }),
      "Couldn't revoke proxy access"
    );
  });
});
