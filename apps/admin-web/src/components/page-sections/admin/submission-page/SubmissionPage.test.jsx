import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { fireEvent, screen, waitFor } from '@testing-library/dom';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { axe } from 'vitest-axe';
import { toHaveNoViolations } from 'vitest-axe/matchers';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SubmissionPage from './SubmissionPage';
import { createLinkingState } from './SubmissionPage.testUtils';

expect.extend({ toHaveNoViolations });

const mocks = vi.hoisted(() => ({
  flowStates: {},
  itemFlow: vi.fn(),
  claimAllItems: vi.fn(),
  getSyllabi: vi.fn(),
  downloadOriginal: vi.fn(),
}));

vi.mock('../../../../services/admin/submissionSyllabiService', async (importOriginal) => ({
  ...await importOriginal(),
  submissionSyllabiService: {
    getSyllabi: mocks.getSyllabi,
    downloadOriginal: mocks.downloadOriginal,
  },
}));

vi.mock('../../../../hooks/admin/useItemFlow', () => ({
  default: ({ item }) => {
    mocks.itemFlow(item);
    return { flowState: mocks.flowStates[`${item.kind}/${item.id}`] || null, loading: false };
  },
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
  readiness: 'unknown',
  readinessReason: 'No catalog identity',
  flow: null,
  displayOrder: id,
  positionInFolder: 1,
  ...values,
});

const pageProps = () => {
  const zetaFirst = makeItem(14, {
    title: 'Done first', status: 'complete', folderName: 'Zeta', displayOrder: 1,
    readiness: 'ready', readinessReason: 'Available online',
    flow: { name: 'Online access', current_step_label: null, finish_state: 'finished' },
  });
  const zetaNext = makeItem(11, {
    title: 'Mine next', status: 'in_progress', folderName: 'Zeta', claimedByUsername: 'staff',
    readiness: 'missing', readinessReason: 'No Five College copy found',
    flow: { name: 'Purchase request', current_step_label: 'Request purchase', finish_state: null },
  });
  const alpha = makeItem(12, {
    title: 'Other staff', displayOrder: 3, folderName: 'Alpha', materialType: 'Journal',
    claimedByUsername: 'other', claimedByDisplay: 'Other Staff',
    readiness: 'unknown', readinessReason: 'No catalog identity',
  });
  const unclaimed = makeItem(13, {
    title: 'Unclaimed item', displayOrder: 4,
    readiness: 'missing', readinessReason: 'No Five College copy found',
  });
  const group = makeItem(15, {
    title: 'Group item', displayOrder: 5, assignedGroup: { id: 7, name: 'Cataloguing' },
    readiness: 'ready', readinessReason: 'Available at a Five College library',
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
    linking: createLinkingState({
      clearError: vi.fn(),
      loadTimeline: vi.fn(),
      actions: { recheck: vi.fn(), unlink: vi.fn() },
      searchCandidates: vi.fn(),
    }),
    renderSelectedItem: (item) => <div data-testid="selected-work-item">{item.title}</div>,
    unlinkedContent: <div>Existing linking panel</div>,
  };
};

const syllabusFixtures = () => ([
  {
    id: 41,
    source: 'google_doc',
    source_url: 'https://docs.google.com/document/d/synthetic-doc/edit',
    original_filename: null,
    mime_type: 'text/plain',
    byte_size: null,
    extracted_text: 'Synthetic folder\nAuthor, Synthetic article title.',
    created_at: '2026-10-20T12:00:00Z',
    added_by: 'Synthetic Faculty',
    added_by_role: 'faculty',
  },
  {
    id: 42,
    source: 'upload',
    source_url: null,
    original_filename: 'test-syllabus.docx',
    mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    byte_size: 2048,
    extracted_text: 'Uploaded outline\n\nA citation on a new line.',
    created_at: '2026-10-21T12:00:00Z',
    added_by: 'Synthetic Staff',
    added_by_role: 'staff',
  },
]);

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
  mocks.itemFlow.mockReset();
  mocks.getSyllabi.mockReset().mockResolvedValue([]);
  mocks.downloadOriginal.mockReset();
  mocks.flowStates = {
    'new/11': {
      flow: { name: 'Print book' },
      current_step: { step: { label: 'Request recall' } },
    },
  };
  mocks.claimAllItems.mockReset().mockResolvedValue({ claimed: [], skipped: [] });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  view?.unmount();
  view = null;
  document.body.innerHTML = '';
});

describe('SubmissionPage', () => {
  it('hides the Syllabus count when no syllabi are attached', async () => {
    view = await renderPage();

    await waitFor(() => expect(mocks.getSyllabi).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('button', { name: /syllabus/i })).toBeNull();
  });

  it('loads attached syllabi once and shows their count in the header', async () => {
    mocks.getSyllabi.mockResolvedValueOnce(syllabusFixtures());
    view = await renderPage();

    const trigger = await screen.findByRole('button', { name: /syllabus.*2/i });
    expect(trigger).toBeTruthy();
    expect(mocks.getSyllabi).toHaveBeenCalledTimes(1);
    expect(mocks.getSyllabi).toHaveBeenCalledWith(31);
    expect(view.container.querySelectorAll('[data-item-row]')).toHaveLength(5);
  });

  it('shows both syllabus sources and keeps extracted text collapsed until requested', async () => {
    mocks.getSyllabi.mockResolvedValueOnce(syllabusFixtures());
    view = await renderPage();
    await act(async () => fireEvent.click(await screen.findByRole('button', { name: /syllabus.*2/i })));

    const sheet = await screen.findByRole('dialog', { name: 'Submission syllabi' });
    const googleLink = screen.getByRole('link', { name: 'Google Doc' });
    expect(googleLink.getAttribute('href')).toBe('https://docs.google.com/document/d/synthetic-doc/edit');
    expect(googleLink.getAttribute('target')).toBe('_blank');
    expect(googleLink.getAttribute('rel')).toContain('noreferrer');
    expect(sheet.textContent.match(/test-syllabus\.docx/g)).toHaveLength(1);
    expect(sheet.textContent).toContain('2 KB');
    expect(sheet.textContent).toContain('Added by Synthetic Faculty (faculty) on');
    expect(sheet.textContent).toContain('Added by Synthetic Staff (staff) on');

    const details = Array.from(sheet.querySelectorAll('details'));
    expect(details).toHaveLength(2);
    expect(details.every((element) => !element.open)).toBe(true);
    await act(async () => fireEvent.click(screen.getAllByText('Extracted text')[0]));
    expect(details[0].open).toBe(true);
    expect(details[0].querySelector('p').className).toContain('tw-whitespace-pre-wrap');
  });

  it('shows a generic load error with its reference', async () => {
    mocks.getSyllabi.mockRejectedValueOnce({
      payload: { error_code: 'syllabus_unavailable', message: 'Synthetic provider detail', reference: 'SYNTH-LOAD-1' },
    });
    view = await renderPage();

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Syllabi could not be loaded');
    expect(alert.textContent).toContain('SYNTH-LOAD-1');
    expect(alert.textContent).not.toContain('Synthetic provider detail');
  });

  it('downloads an uploaded original and announces progress', async () => {
    mocks.getSyllabi.mockResolvedValueOnce(syllabusFixtures());
    let finishDownload;
    mocks.downloadOriginal.mockReturnValueOnce(new Promise((resolve) => { finishDownload = resolve; }));
    const createObjectURL = vi.fn().mockReturnValue('blob:synthetic-original');
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL: vi.fn() });
    const clickAnchor = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    view = await renderPage();
    await act(async () => fireEvent.click(await screen.findByRole('button', { name: /syllabus.*2/i })));
    await screen.findByRole('dialog', { name: 'Submission syllabi' });

    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Open original' })));
    expect(screen.getByRole('status').textContent).toContain('Downloading test-syllabus.docx');
    expect(mocks.downloadOriginal).toHaveBeenCalledWith(31, 42);
    await act(async () => finishDownload(new Blob(['synthetic original'])));
    await waitFor(() => expect(createObjectURL).toHaveBeenCalled());
    expect(clickAnchor).toHaveBeenCalled();
    expect(document.querySelector('a[download="test-syllabus.docx"]')).toBeNull();
  });

  it('shows a generic download error with its reference', async () => {
    mocks.getSyllabi.mockResolvedValueOnce(syllabusFixtures());
    mocks.downloadOriginal.mockRejectedValueOnce({
      payload: { error_code: 'syllabus_unavailable', message: 'Synthetic provider detail', reference: 'SYNTH-DOWNLOAD-1' },
    });
    view = await renderPage();
    await act(async () => fireEvent.click(await screen.findByRole('button', { name: /syllabus.*2/i })));
    await screen.findByRole('dialog', { name: 'Submission syllabi' });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Open original' })));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('original could not be downloaded');
    expect(alert.textContent).toContain('SYNTH-DOWNLOAD-1');
    expect(alert.textContent).not.toContain('Synthetic provider detail');
  });

  it('keeps the open sheet accessible and restores focus to its trigger on close', async () => {
    mocks.getSyllabi.mockResolvedValueOnce(syllabusFixtures());
    view = await renderPage();
    const trigger = await screen.findByRole('button', { name: /syllabus.*2/i });
    await act(async () => fireEvent.click(trigger));
    await screen.findByRole('dialog', { name: 'Submission syllabi' });

    expect(await axe(document.body)).toHaveNoViolations();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Close' })));
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

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
    expect(view.container.textContent).toContain('Book · Purchase request · Request purchase');
    expect(view.container.textContent).toContain('You');
    expect(view.container.textContent).toContain('Other Staff');
    expect(view.container.textContent).toContain('Cataloguing');
    expect(view.container.textContent).toContain('Unclaimed');
    expect(view.container.textContent).toContain('Done');
  });

  it('shows detail flow and readiness without requesting a flow for each row', async () => {
    view = await renderPage();

    expect(screen.getByText('2 of 5 ready')).toBeTruthy();
    expect(view.container.textContent).toContain('Ready: 2 · In progress: 0 · Missing: 2 · Unknown: 1');
    expect(screen.getAllByText('Missing')).toHaveLength(2);
    expect(view.container.querySelector('[data-item-row="11"]').textContent)
      .toContain('Book · Purchase request · Request purchase');
    expect(view.container.querySelector('[data-item-select="11"]').getAttribute('aria-description'))
      .toBe('Readiness: Missing. No Five College copy found');
    expect(mocks.itemFlow).not.toHaveBeenCalled();
  });

  it('shows and counts In progress without including it in Not ready', async () => {
    const props = pageProps();
    props.folders[1].items[0].readiness = 'in_progress';
    view = await renderPage(props);

    expect(view.container.textContent).toContain('Ready: 1 · In progress: 1 · Missing: 2 · Unknown: 1');
    expect(screen.getByRole('button', { name: 'Not ready (3)' })).toBeTruthy();
    expect(screen.getAllByText('In progress')).toHaveLength(1);

    await click(screen.getByRole('button', { name: 'Not ready (3)' }));
    expect(rowIds(view.container)).toEqual(['11', '12', '13']);
  });

  it('filters the list to missing and unknown readiness without changing other filter counts', async () => {
    view = await renderPage();

    await click(screen.getByRole('button', { name: 'Not ready (3)' }));

    expect(rowIds(view.container)).toEqual(['11', '12', '13']);
    expect(view.container.textContent).toContain('Mine (1)');
    expect(view.container.textContent).toContain('Done (1)');
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
