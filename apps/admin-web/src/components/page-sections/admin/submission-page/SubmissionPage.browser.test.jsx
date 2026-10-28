import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, getByRole } from '@testing-library/dom';
import { page } from '@vitest/browser/context';
import { MemoryRouter } from 'react-router-dom';
import { createAdminTabRegistry, getVisibleAdminGroups } from '../../../../pages/adminTabRegistry';
import AdminNavigationSidebar from '../../../layout/admin-nav/AdminNavigationSidebar';
import { expectNoAxeViolations, expectNoHorizontalOverflow } from '../../../../test/browser';
import SubmissionPage from './SubmissionPage';
import ItemWorkPane from './item-pane/ItemWorkPane';
import { createLinkingState } from './SubmissionPage.testUtils';

const mocks = vi.hoisted(() => ({
  claimAllItems: vi.fn(),
  itemFlow: vi.fn(),
  getSyllabi: vi.fn().mockResolvedValue([]),
  downloadOriginal: vi.fn(),
}));

vi.mock('../../../../hooks/admin/useItemFlow', () => ({
  default: (...args) => {
    mocks.itemFlow(...args);
    return { flowState: null, loading: false };
  },
}));
vi.mock('../../../../services/admin/workflowClaims/claimsApi', () => ({
  claimsApi: { claimAllItems: mocks.claimAllItems },
}));
vi.mock('../../../../services/admin/submissionSyllabiService', async (importOriginal) => ({
  ...await importOriginal(),
  submissionSyllabiService: {
    getSyllabi: mocks.getSyllabi,
    downloadOriginal: mocks.downloadOriginal,
  },
}));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const registry = createAdminTabRegistry({
  canManageCourses: true,
  canManageResources: true,
  canManageSubmissions: true,
  canViewReports: true,
  canManageWorkflows: true,
  canCustomize: true,
  isAdmin: true,
  canManageProxyAccess: true,
});
const longUrl = `https://example.test/${'x'.repeat(179)}`;
const longTitle = `Synthetic course reserve title ${'with additional words '.repeat(8)}`;
const longClaim = `Synthetic staff member ${'with a very long display name '.repeat(4)}`;
const item = {
  id: 'test-item-1',
  title: longTitle,
  authors: 'Synthetic Author',
  materialType: 'Book',
  eds: { plink: longUrl },
  status: 'pending',
  readiness: 'missing',
  readinessReason: 'No Five College copy was found for this catalog identity.',
  flow: {
    name: `Purchase workflow ${'with a long label '.repeat(4)}`,
    current_step_label: 'Request purchase',
    finish_state: null,
  },
  claimed_by: 'synthetic-staff',
  claimed_by_display: longClaim,
  displayOrder: 1,
  positionInFolder: 1,
};

function PageContent() {
  return (
    <SubmissionPage
      submission={{
        id: 31,
        uuid: 'test-submission-31',
        courseCode: 'ENG 101',
        courseTitle: 'Synthetic Literature',
        section: '01',
        term: 'Fall 2026',
        facultyName: 'Test Faculty',
        submittedAt: '2026-06-16T12:00:00Z',
        status: 'processing',
        isLocked: false,
        linkState: 'linked',
        folioCourseListingId: 'test-listing-31',
      }}
      folders={[]}
      unfolderedItems={[item]}
      currentUser={{ id: '999000001', username: 'devadmin' }}
      onBack={() => {}}
      onLock={() => {}}
      onUnlock={() => {}}
      linking={createLinkingState()}
      renderSelectedItem={(selected) => (
        <ItemWorkPane
          key={`${selected.kind}/${selected.id}`}
          item={selected}
          submission={{ facultyName: 'Test Faculty' }}
          currentUsername="devadmin"
          onChanged={() => {}}
          onGoToWork={() => {}}
          onReopen={() => {}}
        />
      )}
    />
  );
}

function WorkbenchShell() {
  const [isCollapsed, setCollapsed] = useState(true);
  const navigation = {
    activeTab: 'submissions',
    counts: { 'my-work': 2, submissions: 3, mentions: 4 },
    isCollapsed,
    setCollapsed,
    isPinLimitReached: false,
    isSaving: false,
    pins: ['my-work'],
    pinsLoaded: true,
    pinnedTabs: [registry.tabs.find(({ key }) => key === 'my-work')],
    resetPins: () => {},
    saveError: '',
    statusMessage: '',
    tabRegistry: registry,
    togglePin: () => {},
    visibleGroups: getVisibleAdminGroups(registry),
  };

  return (
    <div className="tw-flex tw-min-w-0 tw-flex-col md:tw-flex-row">
      <AdminNavigationSidebar navigation={navigation} />
      <main className="tw-min-w-0 tw-flex-1 tw-px-4 tw-py-3"><PageContent /></main>
    </div>
  );
}

describe('SubmissionPage workbench in Chromium', () => {
  let container;
  let root;

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    container = null;
    root = null;
  });

  it('keeps the workbench accessible and reflowed with collapsed and expanded navigation', async () => {
    await page.viewport(1280, 900);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root.render(
      <MemoryRouter initialEntries={['/admin/submissions/31?item=test-item-1']}>
        <WorkbenchShell />
      </MemoryRouter>,
    ));

    const nav = container.querySelector('[aria-label="Admin navigation panel"]');
    expect(nav.className).toContain('tw-w-16');
    expect(container.textContent).toContain(longTitle);
    expect(container.textContent).toContain(longClaim);
    expect(container.textContent).toContain('Synthetic Author');
    expect(container.textContent).toContain('Book');
    expect(getByRole(container, 'link', { name: /View full record/ }).getAttribute('href')).toBe(longUrl);
    expect(getByRole(container, 'tab', { name: 'Process' }).className).toContain('tw-border-b-2');
    expect(getComputedStyle(container.querySelector('[aria-label="Access path"]')).borderTopWidth).toBe('0px');
    expect(mocks.itemFlow).toHaveBeenCalledTimes(1);
    await expectNoHorizontalOverflow([1280]);
    await expectNoAxeViolations(container);
    await page.screenshot({ path: 'dist/test-results/AW-073-submission-1280.png' });

    await page.viewport(1024, 900);
    await act(async () => fireEvent.click(getByRole(container, 'button', { name: 'Expand admin navigation' })));
    expect(nav.className).toContain('tw-w-72');
    const grid = container.querySelector('[data-testid="submission-workbench-grid"]');
    expect(getComputedStyle(grid).gridTemplateColumns.split(' ')[0]).toBe('260px');
    await expectNoHorizontalOverflow([1024]);
    await expectNoAxeViolations(container);

    await page.viewport(768, 900);
    expect(getByRole(container, 'button', { name: 'Back to list' })).toBeTruthy();
    await expectNoHorizontalOverflow([320, 768, 1280]);
  });
});
