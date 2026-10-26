import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import SubmissionPage from './SubmissionPage';
import { createLinkingState } from './SubmissionPage.testUtils';
import { expectNoHorizontalOverflow } from '../../../../test/browser';

const mocks = vi.hoisted(() => ({ claimAllItems: vi.fn() }));

vi.mock('../../../../hooks/admin/useItemFlow', () => ({
  default: () => ({ flowState: null, loading: false }),
}));
vi.mock('../../../../services/admin/workflowClaims/claimsApi', () => ({
  claimsApi: { claimAllItems: mocks.claimAllItems },
}));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const longUrl = `https://example.test/${'x'.repeat(179)}`;
const longTitle = `Synthetic course reserve title ${'with additional words '.repeat(8)}`;
const item = {
  id: 'test-item-1',
  title: longTitle,
  url: longUrl,
  materialType: 'Book',
  status: 'pending',
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
        <div>
          <h2>{selected.title}</h2>
          <a href={selected.url}>{selected.url}</a>
        </div>
      )}
    />
  );
}

describe('SubmissionPage in Chromium', () => {
  let container;
  let root;

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    container = null;
    root = null;
  });

  it('reflows a linked submission with a long title and 200-character URL', async () => {
    expect(longUrl).toHaveLength(200);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root.render(
      <MemoryRouter initialEntries={['/admin/submissions/31?item=test-item-1']}>
        <PageContent />
      </MemoryRouter>,
    ));

    expect(container.textContent).toContain(longTitle);
    expect(container.querySelector('a')?.getAttribute('href')).toBe(longUrl);
    await expectNoHorizontalOverflow();
  });
});
