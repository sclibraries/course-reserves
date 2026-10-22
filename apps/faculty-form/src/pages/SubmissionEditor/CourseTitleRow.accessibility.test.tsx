import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { getByRole } from '@testing-library/dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations } from '@/test/expectNoAxeViolations';
import CourseTitleRow from './CourseTitleRow';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('CourseTitleRow accessibility', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    container = null;
    root = null;
  });

  it('exposes the course heading and disables course editing when read-only', async () => {
    const onEditCourse = vi.fn();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => root?.render(
      <main>
        <h1>Course Reserves</h1>
        <CourseTitleRow
          courseCode="BIO 101"
          courseTitle="Biology"
          section="01"
          term="Fall 2026"
          isReadOnly
          onEditCourse={onEditCourse}
        />
      </main>,
    ));

    expect(getByRole(container, 'heading', { level: 2, name: 'BIO 101 · Biology' })).toBeTruthy();
    expect(getByRole(container, 'button', { name: 'Edit Course Info' }).hasAttribute('disabled')).toBe(true);
    await expectNoAxeViolations(container);
  });
});
