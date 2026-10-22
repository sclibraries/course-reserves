import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SubmissionPage from './SubmissionPage';

const mocks = vi.hoisted(() => ({ flowStates: {}, claimAllItems: vi.fn() }));

vi.mock('../../../../hooks/admin/useItemFlow', () => ({
  default: ({ item }) => ({ flowState: mocks.flowStates[`${item.kind}/${item.id}`] || null, loading: false }),
}));

vi.mock('../../../../services/admin/workflowClaims/claimsApi', () => ({
  claimsApi: { claimAllItems: mocks.claimAllItems },
}));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const makeItem = (id, values = {}) => ({
  id: String(id),
  title: `Synthetic item ${id}`,
  materialType: 'Book',
  status: 'pending',
  displayOrder: id,
  positionInFolder: 1,
  ...values,
});

const pageProps = () => {
  const zetaFirst = makeItem(14, { title: 'Done first', status: 'complete', folderName: 'Zeta', displayOrder: 1 });
  const zetaNext = makeItem(11, {
    title: 'Mine next', status: 'in_progress', folderName: 'Zeta', claimedByUsername: 'staff',
  });
  const alpha = makeItem(12, {
    title: 'Other staff', displayOrder: 3, folderName: 'Alpha', materialType: 'Journal',
    claimedByUsername: 'other', claimedByDisplay: 'Other Staff',
  });
  const unclaimed = makeItem(13, { title: 'Unclaimed item', displayOrder: 4 });
  const group = makeItem(15, {
    title: 'Group item', displayOrder: 5, assignedGroup: { id: 7, name: 'Cataloguing' },
  });
  return {
    submission: {
      id: 31,
      uuid: 'synthetic-submission',
      courseCode: 'ENG 101',
      courseTitle: 'Synthetic Literature',
      section: '01',
      term: 'Fall 2026',
      facultyName: 'Synthetic Faculty',
      submittedAt: '2026-06-16T12:00:00Z',
      status: 'processing',
      isLocked: false,
      linkState: 'linked',
      folioCourseListingId: 'folio-course-123',
    },
    folders: [
      { name: 'Alpha', items: [alpha] },
      { name: 'Zeta', items: [zetaFirst, zetaNext] },
    ],
    unfolderedItems: [unclaimed, group],
    currentUser: { id: '17', username: 'staff' },
    onLock: vi.fn(),
    onUnlock: vi.fn(),
    onChanged: vi.fn(),
    onBack: vi.fn(),
    linking: {
      clearError: vi.fn(),
      loadTimeline: vi.fn(),
      timeline: [],
      timelineLoading: false,
      timelineError: '',
      currentCandidate: null,
      isPublished: false,
      candidateLoading: false,
      saving: false,
      error: '',
      actions: { recheck: vi.fn(), unlink: vi.fn() },
      searchCandidates: vi.fn(),
    },
    renderSelectedItem: (item) => <div data-testid="selected-work-item">{item.title}</div>,
    unlinkedContent: <div>Existing linking panel</div>,
  };
};

function LocationSearch() {
  return <output data-testid="location-search">{useLocation().search}</output>;
}

async function renderPage(props = pageProps(), entry = '/admin/submissions/31') {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const render = (nextProps = props) => root.render(
    <MemoryRouter initialEntries={[entry]}>
      <LocationSearch />
      <SubmissionPage {...nextProps} />
    </MemoryRouter>,
  );
  await act(async () => render());

  return {
    container,
    rerender: async (nextProps = props) => act(async () => render(nextProps)),
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

const click = async (element) => act(async () => {
  element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
});

const rowIds = (container) => Array.from(container.querySelectorAll('[data-item-row]'))
  .map((row) => row.dataset.itemRow);

let view;

beforeEach(() => {
  mocks.flowStates = {
    'new/11': {
      flow: { name: 'Print book' },
      current_step: { step: { label: 'Request recall' } },
    },
  };
  mocks.claimAllItems.mockReset().mockResolvedValue({ claimed: [], skipped: [] });
});

afterEach(() => {
  view?.unmount();
  view = null;
  document.body.innerHTML = '';
});

describe('SubmissionPage', () => {
  it('constrains the page grid and work pane so content can reflow', async () => {
    view = await renderPage();

    const grid = view.container.querySelector('.tw-grid');
    const workPane = view.container.querySelector('[data-testid="submission-work-pane"]');

    expect(grid.className).toContain('lg:tw-grid-cols-[minmax(0,2fr)_minmax(0,3fr)]');
    expect(view.container.querySelector('[data-testid="submission-item-list-pane"]').className).toContain('tw-min-w-0');
    expect(workPane.parentElement.className).toContain('tw-min-w-0');
    expect(workPane.className).toContain('tw-break-words');
  });

  it('renders each item once in faculty folder order with header and claim states', async () => {
    view = await renderPage();

    expect(rowIds(view.container)).toEqual(['14', '11', '12', '13', '15']);
    expect(Array.from(view.container.querySelectorAll('[data-item-group]')).map((group) => group.dataset.itemGroup))
      .toEqual(['Zeta', 'Alpha', 'Not in a folder']);
    expect(view.container.textContent).toContain('ENG 101');
    expect(view.container.textContent).toContain('Synthetic Literature');
    expect(view.container.textContent).toContain('Section: 01');
    expect(view.container.textContent).toContain('Book · Print book · Request recall');
    expect(view.container.textContent).toContain('You');
    expect(view.container.textContent).toContain('Other Staff');
    expect(view.container.textContent).toContain('Cataloguing');
    expect(view.container.textContent).toContain('Unclaimed');
    expect(view.container.textContent).toContain('Done');
  });

  it('filters items and shows each filter count', async () => {
    view = await renderPage();
    expect(view.container.textContent).toContain('All (5)');
    expect(view.container.textContent).toContain('Mine (1)');
    expect(view.container.textContent).toContain('Unclaimed (1)');
    expect(view.container.textContent).toContain('Done (1)');

    await click(Array.from(view.container.querySelectorAll('button')).find((button) => button.textContent.includes('Mine (1)')));
    expect(rowIds(view.container)).toEqual(['11']);
  });

  it('uses the item query parameter for selection and keeps it through rerenders', async () => {
    view = await renderPage(pageProps(), '/admin/submissions/31?item=12');
    expect(view.container.querySelector('[data-item-select="12"]').getAttribute('aria-pressed')).toBe('true');

    await click(view.container.querySelector('[data-item-select="13"]'));
    expect(view.container.querySelector('[data-testid="location-search"]').textContent).toBe('?item=13');
    await view.rerender();

    expect(view.container.querySelector('[data-testid="location-search"]').textContent).toBe('?item=13');
    expect(view.container.querySelector('[data-item-select="13"]').getAttribute('aria-pressed')).toBe('true');
  });

  it('defaults to the first not-done item and writes that selection into the URL', async () => {
    view = await renderPage();

    expect(view.container.querySelector('[data-item-select="11"]').getAttribute('aria-pressed')).toBe('true');
    expect(view.container.querySelector('[data-testid="location-search"]').textContent).toBe('?item=11');
  });

  it('shows Back to list in the narrow work pane and returns to the list', async () => {
    view = await renderPage();
    await click(view.container.querySelector('[data-item-select="12"]'));
    const backButton = Array.from(view.container.querySelectorAll('button')).find((button) => button.textContent.includes('Back to list'));

    expect(backButton).toBeTruthy();
    expect(backButton.className).toContain('lg:tw-hidden');
    expect(view.container.querySelector('[data-testid="submission-item-list-pane"]').className).toContain('tw-hidden');
    await click(backButton);
    expect(view.container.querySelector('[data-testid="submission-item-list-pane"]').className).not.toContain('tw-hidden');
  });

  it('dims the item list and shows the linking panel when the course is not linked', async () => {
    const props = pageProps();
    props.submission = { ...props.submission, linkState: 'needs_linking', folioCourseListingId: null };
    view = await renderPage(props);

    const listPane = view.container.querySelector('[data-testid="submission-item-list-pane"]');
    const itemButtons = Array.from(listPane.querySelectorAll('button[aria-label^="Select "]'));
    expect(itemButtons.length).toBeGreaterThan(0);
    expect(itemButtons.every((button) => button.disabled)).toBe(true);
    expect(listPane.className).toContain('tw-bg-muted/30');
    expect(listPane.className).toContain('tw-saturate-50');
    expect(listPane.className).not.toContain('tw-opacity-50');
    expect(view.container.textContent).toContain('Existing linking panel');
  });

  it('claims all items through the existing API and refreshes the submission', async () => {
    const props = pageProps();
    view = await renderPage(props);
    await click(Array.from(view.container.querySelectorAll('button')).find((button) => button.textContent.includes('Claim all')));

    expect(mocks.claimAllItems).toHaveBeenCalledWith('synthetic-submission');
    expect(props.onChanged).toHaveBeenCalled();
  });
});
