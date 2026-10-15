import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { SubmissionCard, type Submission } from './SubmissionCard';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const submission: Submission = {
  id: 'submission-test-1',
  courseCode: 'BIO 101',
  courseTitle: 'Synthetic Biology',
  term: 'Fall 2026',
  status: 'draft',
  totalItems: 0,
  completeItems: 0,
  inProgressItems: 0,
  needsReviewItems: 0,
  lastUpdated: 'Aug 1, 2026',
};

describe('SubmissionCard proxy labels', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    container = null;
    root = null;
  });

  const renderSubmission = (access?: Submission['access']) => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root?.render(
        <MemoryRouter>
          <SubmissionCard submission={{ ...submission, access }} />
        </MemoryRouter>,
      );
    });
  };

  it('labels proxy and co-instructor submissions when API access is present', () => {
    renderSubmission('proxy');
    expect(container?.textContent).toContain('Proxy');

    act(() => root?.render(
      <MemoryRouter>
        <SubmissionCard submission={{ ...submission, access: 'co_instructor' }} />
      </MemoryRouter>,
    ));
    expect(container?.textContent).toContain('Co-instructor');
  });

  it('does not add an access label while the API field is absent', () => {
    renderSubmission();
    expect(container?.textContent).not.toContain('Proxy');
    expect(container?.textContent).not.toContain('Co-instructor');
  });

  it('hides the continue-editing control for a view-only proxy submission', () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root?.render(
        <MemoryRouter>
          <SubmissionCard submission={{ ...submission, access: 'proxy', proxyCanEdit: false }} />
        </MemoryRouter>,
      );
    });

    expect(container?.textContent).toContain('Proxy');
    expect(container?.textContent).not.toContain('Continue Editing');
  });
});
