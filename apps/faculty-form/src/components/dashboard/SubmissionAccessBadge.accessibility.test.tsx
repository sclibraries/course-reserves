import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { getByText } from '@testing-library/dom';
import { afterEach, describe, expect, it } from 'vitest';
import { expectNoAxeViolations } from '@/test/expectNoAxeViolations';
import { SubmissionAccessBadge } from './SubmissionAccessBadge';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('SubmissionAccessBadge accessibility', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    container = null;
    root = null;
  });

  it('labels proxy and co-instructor access and has no axe violations', async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => root?.render(
      <main>
        <SubmissionAccessBadge access="proxy" />
        <SubmissionAccessBadge access="co_instructor" />
        <SubmissionAccessBadge access="owner" />
      </main>,
    ));

    expect(getByText(container, 'Proxy')).toBeTruthy();
    expect(getByText(container, 'Co-instructor')).toBeTruthy();
    await expectNoAxeViolations(container);
  });
});
