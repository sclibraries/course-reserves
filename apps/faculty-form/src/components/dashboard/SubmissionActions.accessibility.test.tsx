import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { getByRole, queryByRole } from '@testing-library/dom';
import { afterEach, describe, expect, it } from 'vitest';
import type { Submission } from '@/components/SubmissionCard';
import { expectNoAxeViolations } from '@/test/expectNoAxeViolations';
import { SubmissionActions } from './SubmissionActions';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('SubmissionActions accessibility', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    container = null;
    root = null;
  });

  const renderActions = (submission: Submission) => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root?.render(
      <MemoryRouter>
        <main><SubmissionActions submission={submission} /></main>
      </MemoryRouter>,
    ));
  };

  const submission = (overrides: Partial<Submission>): Submission => ({
    id: 'submission-1',
    courseCode: 'BIO 101',
    courseTitle: 'Biology',
    term: 'Fall 2026',
    status: 'draft',
    totalItems: 0,
    completeItems: 0,
    inProgressItems: 0,
    needsReviewItems: 0,
    lastUpdated: 'Today',
    ...overrides,
  });

  it('shows Edit and Discard for an editable draft', async () => {
    renderActions(submission({ proxyCanEdit: true }));

    expect(getByRole(container!, 'button', { name: 'Edit' })).toBeTruthy();
    expect(getByRole(container!, 'button', { name: 'Discard draft' })).toBeTruthy();
    expect(queryByRole(container!, 'button', { name: 'View' })).toBeNull();
    await expectNoAxeViolations(container!);
  });

  it.each([
    ['read-only draft', submission({ proxyCanEdit: false })],
    ['submitted reserve', submission({ status: 'submitted' })],
  ])('shows View for a %s', (_label, item) => {
    renderActions(item);

    expect(getByRole(container!, 'button', { name: 'View' })).toBeTruthy();
    expect(queryByRole(container!, 'button', { name: 'Edit' })).toBeNull();
    expect(queryByRole(container!, 'button', { name: 'Discard draft' })).toBeNull();
  });
});
