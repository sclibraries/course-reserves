import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { getByRole } from '@testing-library/dom';
import { afterEach, describe, expect, it } from 'vitest';
import { Button } from '@/components/ui/button';
import { expectNoAxeViolations } from '@/test/expectNoAxeViolations';
import { DashboardCourseCard } from './DashboardCourseCard';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('DashboardCourseCard accessibility', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    container = null;
    root = null;
  });

  it('uses a level-three course heading and has no axe violations', async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => root?.render(
      <main>
        <h2>Course Reserves</h2>
        <DashboardCourseCard
          code="BIO 101"
          title="Biology"
          term="Fall 2026"
          status="Draft"
          items="2 total · 1 complete"
          lastUpdated="Today"
          actions={<Button>Edit</Button>}
        />
      </main>,
    ));

    expect(getByRole(container, 'heading', { level: 3, name: 'BIO 101 · Biology' })).toBeTruthy();
    await expectNoAxeViolations(container);
  });
});
