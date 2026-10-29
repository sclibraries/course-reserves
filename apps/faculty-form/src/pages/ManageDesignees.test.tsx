import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ManageDesignees from './ManageDesignees';

const mocks = vi.hoisted(() => ({
  getMyProxies: vi.fn(),
  inviteProxy: vi.fn(),
  revokeProxy: vi.fn(),
  getProxyActivityLog: vi.fn(),
  fetchCourseAssignments: vi.fn(),
  role: 'faculty',
}));

vi.mock('@/services/api/facultyProxyApi', () => ({
  getMyProxies: mocks.getMyProxies,
  inviteProxy: mocks.inviteProxy,
  revokeProxy: mocks.revokeProxy,
  getProxyActivityLog: mocks.getProxyActivityLog,
}));

vi.mock('@/store/authStore', () => ({
  useAuthStore: (selector: (state: { user: { role: string } }) => unknown) => (
    selector({ user: { role: mocks.role } })
  ),
}));

vi.mock('@/store/courseAssignmentsStore', () => ({
  useCourseAssignmentsStore: () => ({
    assignments: [{
      assignment: { course_id: 'BIO-101-01', course_title: 'Synthetic Biology' },
      parsed_course: { courseNumber: 'BIO 101', sectionName: '01', raw: 'BIO 101-01' },
      folio_term: { id: 'term-test-1', name: 'Fall 2026', startDate: '', endDate: '' },
      folio_course: { courseListingId: 'test-listing-1', name: 'Synthetic Biology' },
    }],
    fetchCourseAssignments: mocks.fetchCourseAssignments,
  }),
}));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const proxy = {
  permission_id: 42,
  proxy_display_name: 'Test Designee',
  proxy_email: 'test-proxy@example.test',
  scope_summary: 'Edit selected courses (1)',
  courses: [{ folio_course_listing_id: 'test-listing-1', course_title: 'Synthetic Biology' }],
  status: 'pending',
  invitation_expires_at: '2099-01-01T00:00:00Z',
};

describe('ManageDesignees', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;
  let copyText: ReturnType<typeof vi.fn>;
  const originalClipboard = navigator.clipboard;

  beforeEach(() => {
    mocks.role = 'faculty';
    mocks.getMyProxies.mockReset().mockResolvedValue({ items: [proxy], count: 1 });
    mocks.inviteProxy.mockReset().mockResolvedValue({
      success: true,
      invitation_url: 'http://localhost:5174/form/faculty/accept-proxy-invitation/test-token',
    });
    mocks.revokeProxy.mockReset().mockResolvedValue({ success: true });
    mocks.getProxyActivityLog.mockReset().mockResolvedValue({
      items: [{ activity_id: 91, action: 'invited', created_at: '2026-08-01T12:00:00Z' }],
      count: 1,
    });
    mocks.fetchCourseAssignments.mockReset().mockResolvedValue(undefined);
    copyText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: copyText },
    });
  });

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    container = null;
    root = null;
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: originalClipboard });
  });

  const renderPage = async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root?.render(<MemoryRouter><ManageDesignees /></MemoryRouter>);
      await Promise.resolve();
    });
  };

  const clickButton = async (text: string) => {
    const button = [...(container?.querySelectorAll('button') || [])]
      .find((candidate) => candidate.textContent?.includes(text));
    expect(button).toBeDefined();
    await act(async () => {
      button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });
  };

  const setValue = (selector: string, value: string) => {
    const field = container?.querySelector<HTMLInputElement | HTMLSelectElement>(selector);
    expect(field).toBeDefined();
    act(() => {
      if (field instanceof HTMLInputElement) {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(field, value);
        field.dispatchEvent(new Event('input', { bubbles: true }));
      } else if (field) {
        field.value = value;
        field.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
  };

  const submitForm = async () => {
    const form = container?.querySelector('form');
    expect(form).toBeDefined();
    await act(async () => {
      form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });
  };

  it('renders a designee summary with scope, courses, status, and expiry', async () => {
    await renderPage();

    expect(container?.textContent).toContain('Test Designee');
    expect(container?.textContent).toContain('test-proxy@example.test');
    expect(container?.textContent).toContain('Edit selected courses (1)');
    expect(container?.textContent).toContain('Synthetic Biology');
    expect(container?.textContent).toContain('pending');
    expect(container?.textContent).toContain('12/31/2098');
  });

  it('invites the chosen course with the default specific-courses scope and offers copy', async () => {
    await renderPage();
    setValue('input[type="email"]', 'test-proxy@example.test');
    const course = container?.querySelector<HTMLInputElement>('input[type="checkbox"]');
    expect(course).toBeDefined();
    await act(async () => course?.click());
    await submitForm();

    expect(mocks.inviteProxy).toHaveBeenCalledWith({
      proxy_email: 'test-proxy@example.test',
      permission_type: 'specific_courses',
      course_permissions: [{ folio_course_listing_id: 'test-listing-1' }],
    });
    expect(container?.textContent).toContain('Emailing isn’t automatic yet.');
    expect(container?.textContent).toContain('http://localhost:5174/form/faculty/accept-proxy-invitation/test-token');
    await clickButton('Copy');
    expect(copyText).toHaveBeenCalledWith('http://localhost:5174/form/faculty/accept-proxy-invitation/test-token');
  });

  it.each([
    ['full_access', 'Edit all courses'],
    ['view_only', 'View only'],
  ])('sends the %s scope option', async (permissionType, label) => {
    await renderPage();
    setValue('input[type="email"]', 'test-proxy@example.test');
    setValue('select[name="permission_type"]', permissionType);
    await submitForm();

    expect(mocks.inviteProxy).toHaveBeenCalledWith({
      proxy_email: 'test-proxy@example.test',
      permission_type: permissionType,
    });
    expect(container?.textContent).toContain(label);
  });

  it('requires confirmation before revoking an existing invitation', async () => {
    await renderPage();
    await clickButton('Revoke');

    expect(container?.textContent).toContain('Revoke this designee?');
    expect(mocks.revokeProxy).not.toHaveBeenCalled();
    await clickButton('Confirm revoke');

    expect(mocks.revokeProxy).toHaveBeenCalledWith(42);
  });

  it('loads the activity log only when the collapsible section opens', async () => {
    await renderPage();
    expect(mocks.getProxyActivityLog).not.toHaveBeenCalled();
    const section = container?.querySelector('details');
    expect(section).toBeDefined();
    await act(async () => {
      if (section) section.open = true;
      section?.dispatchEvent(new Event('toggle'));
      await Promise.resolve();
    });

    expect(mocks.getProxyActivityLog).toHaveBeenCalledOnce();
    expect(container?.textContent).toContain('invited');
  });

  it('shows a generic load error with its reference instead of server text', async () => {
    mocks.getMyProxies.mockRejectedValue({
      response: { data: { message: 'database password leaked', reference_id: '7F3K2Q' } },
    });
    await renderPage();

    await vi.waitFor(() => expect(container?.textContent).toContain("Couldn't load designees"));
    expect(container?.textContent).toContain('Reference: 7F3K2Q');
    expect(container?.textContent).not.toContain('database password leaked');
  });

  it('shows a short message instead of management controls for non-faculty roles', async () => {
    mocks.role = 'employee';
    await renderPage();

    expect(container?.textContent).toContain('Only faculty can designate a proxy.');
    expect(container?.querySelector('form')).toBeNull();
    expect(mocks.getMyProxies).not.toHaveBeenCalled();
  });
});
