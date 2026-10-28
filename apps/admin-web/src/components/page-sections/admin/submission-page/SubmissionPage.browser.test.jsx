import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, getByRole, queryByRole, within } from '@testing-library/dom';
import { page } from '@vitest/browser/context';
import { MemoryRouter } from 'react-router-dom';
import { createAdminTabRegistry, getVisibleAdminGroups } from '../../../../pages/adminTabRegistry';
import { expectNoAxeViolations, expectNoHorizontalOverflow } from '../../../../test/browser';
import '../../../../css/App.css';
import WorkbenchShell from './SubmissionPage.browser.testUtils';
import { longClaim, longTitle, longTitleFolders, longUrl, screenshotFolders } from './SubmissionPage.browser.fixtures';

const mocks = vi.hoisted(() => ({
  claimAllItems: vi.fn(),
  itemFlow: vi.fn(),
  getSyllabi: vi.fn().mockResolvedValue([]),
  downloadOriginal: vi.fn(),
  navigation: null,
}));

vi.mock('../../../../hooks/admin/useItemFlow', () => ({
  default: (...args) => {
    mocks.itemFlow(...args);
    return {
      flowState: {
        flow: { id: 7, name: 'Synthetic workflow', version: 1 },
        current_step: { step: {
          key: 'own_it', kind: 'question', label: 'Do we own it?', help_text: 'Check the synthetic catalog.',
          outcomes: [
            { key: 'yes', label: 'Yes', next: { step: 'available' }, reason_required: false },
            { key: 'no', label: 'No', next: { step: 'order' }, reason_required: false },
          ],
        } },
        finished: null,
        history: [],
        can_act: true,
      },
      loading: false,
      pending: false,
      notes: '',
      selectedOutcome: null,
      clearNotice: () => {},
      clearError: () => {},
      loadFlow: () => {},
      replaceFlowState: () => {},
      handleOutcome: () => {},
      setNotes: () => {},
    };
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
vi.mock('../../../../contexts/AuthContext', () => ({ useAuth: () => ({ isAuthenticated: false, user: null }) }));
vi.mock('../../../../hooks/useUnreadMessages', () => {
  const useUnreadMessages = () => ({ unreadCount: 0 });
  return { default: useUnreadMessages, useUnreadMessages };
});
vi.mock('../../../ui/LoginButton', () => ({ default: () => null }));
vi.mock('../../../../hooks/admin/useAdminNavigation', async (importOriginal) => {
  const original = await importOriginal();
  const { useState } = await import('react');
  return {
    ...original,
    useAdminNavigation: () => {
      const [isCollapsed, setCollapsed] = useState(true);
      return { ...mocks.navigation, isCollapsed, setCollapsed };
    },
  };
});

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
mocks.navigation = {
  activeTab: 'submissions',
  counts: { 'my-work': 2, submissions: 3, mentions: 4 },
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

describe('SubmissionPage workbench in Chromium', () => {
  let container;
  let root;

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    container = null;
    root = null;
  });

  async function mountWorkbench(folders = screenshotFolders, selectedItemId = folders[0].items[0].id) {
    container = document.createElement('div');
    container.id = 'root';
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root.render(
      <MemoryRouter initialEntries={[`/admin/submissions/31?item=${selectedItemId}`]}>
        <WorkbenchShell folders={folders} />
      </MemoryRouter>,
    ));
  }

  function expectShortPageBackgroundFitsViewport(width) {
    const content = container.querySelector('[data-testid="admin-layout-content"]');
    expect(getComputedStyle(content).backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
    expect(content.getBoundingClientRect().bottom, `${width}px muted area bottom`)
      .toBeGreaterThanOrEqual(window.innerHeight - 1);
    expect(document.documentElement.scrollHeight, `${width}px document height`)
      .toBeLessThanOrEqual(window.innerHeight + 1);
  }

  function expectMutedAreaCoversViewportBelowHeader(width) {
    const content = container.querySelector('[data-testid="admin-layout-content"]');
    const headerHeight = container.querySelector('header .navbar').getBoundingClientRect().height;
    expect(getComputedStyle(content).backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
    expect(content.getBoundingClientRect().height, `${width}px muted area height`)
      .toBeGreaterThanOrEqual(window.innerHeight - headerHeight);
  }

  it('keeps the workbench accessible and reflowed with collapsed and expanded navigation', async () => {
    await page.viewport(1280, 900);
    await mountWorkbench();

    const nav = container.querySelector('[aria-label="Admin navigation panel"]');
    expect(nav.className).toContain('tw-w-16');
    expectShortPageBackgroundFitsViewport(1280);
    expect(container.querySelectorAll('[data-item-row]')).toHaveLength(3);
    expect(Array.from(container.querySelectorAll('[data-item-group]'), (group) => group.dataset.itemGroup))
      .toEqual(['Core readings', 'Further reading']);
    expect(Array.from(container.querySelectorAll('[data-row-claim]'), (claim) => claim.textContent.replace('Claim: ', '')))
      .toEqual(['You', 'Synthetic Staff Member', 'Unclaimed']);
    expect(container.textContent).toContain('The Glass Orchard');
    expect(container.textContent).toContain('A Map of Quiet Places');
    expect(container.textContent).toContain('History of the Blue River');
    expect(container.textContent).toContain('Claimed by you');
    expect(container.textContent).toContain('Synthetic Staff Member');
    expect(container.textContent).toContain('Unclaimed');
    expect(container.textContent).toContain('Synthetic Author');
    expect(container.textContent).toContain('Book');
    expect(getByRole(container, 'link', { name: /View full record/ }).getAttribute('href')).toBe(longUrl);
    expect(getByRole(container, 'tab', { name: 'Process' }).className).toContain('tw-border-b-2');
    expect(getComputedStyle(container.querySelector('[aria-label="Access path"]')).borderTopWidth).toBe('0px');
    expect(mocks.itemFlow).toHaveBeenCalledTimes(1);
    await expectNoHorizontalOverflow([1280]);
    await expectNoAxeViolations(container);
    await page.screenshot({ path: '../../../../../dist/test-results/AW-074-admin-1280.png' });
    await page.screenshot({ path: '../../../../../dist/test-results/AW-075-claimed-missing-1280.png' });

    await page.viewport(1024, 900);
    await act(async () => fireEvent.click(getByRole(container, 'button', { name: 'Expand admin navigation' })));
    expectShortPageBackgroundFitsViewport(1024);
    expect(nav.className).toContain('tw-w-72');
    const grid = container.querySelector('[data-testid="submission-workbench-grid"]');
    expect(getComputedStyle(grid).gridTemplateColumns.split(' ')[0]).toBe('260px');
    await expectNoHorizontalOverflow([1024]);
    await expectNoAxeViolations(container);

    await page.viewport(768, 900);
    expect(getByRole(container, 'button', { name: 'Back to list' })).toBeTruthy();
    await expectNoHorizontalOverflow([320, 768, 1280]);
    for (const width of [320, 768]) {
      await page.viewport(width, 900);
      expectMutedAreaCoversViewportBelowHeader(width);
    }
  });

  it('keeps long row titles and claimers intact while clamping their visible layout', async () => {
    await page.viewport(1280, 900);
    await mountWorkbench(longTitleFolders);

    const row = container.querySelector('[data-item-row="test-long-title"]');
    const title = row.querySelector('[data-row-title]');
    const claimer = row.querySelector('[data-row-claim]');
    expect(title.className).toContain('tw-line-clamp-3');
    expect(title.getAttribute('title')).toBe(longTitle);
    expect(title.textContent).toBe(longTitle);
    expect(claimer.className).toContain('tw-truncate');
    expect(claimer.getAttribute('title')).toBe(longClaim);
    expect(claimer.textContent).toContain(longClaim);
    await expectNoHorizontalOverflow([1280, 1024, 320]);
  });

  it('keeps an unclaimed Missing item readable, accessible, and reflowed', async () => {
    await page.viewport(1280, 900);
    await mountWorkbench(screenshotFolders, 'test-item-3');
    const process = within(container).getByRole('region', { name: 'Process History of the Blue River' });

    expect(getByRole(process, 'heading', { name: 'Do we own it?' })).toBeTruthy();
    expect(within(process).getByRole('status').textContent).toContain('Claim this item to work on it');
    expect(queryByRole(process, 'button', { name: 'Yes' })).toBeNull();
    expect(queryByRole(process, 'button', { name: 'No' })).toBeNull();
    expect(queryByRole(process, 'combobox', { name: 'Access path' })).toBeNull();
    expect(queryByRole(process, 'button', { name: 'Save access path' })).toBeNull();
    await page.screenshot({ path: '../../../../../dist/test-results/AW-075-unclaimed-missing-1280.png' });

    for (const width of [320, 768, 1280]) {
      await page.viewport(width, 900);
      await expectNoHorizontalOverflow([width]);
      await expectNoAxeViolations(container);
    }
  });
});
