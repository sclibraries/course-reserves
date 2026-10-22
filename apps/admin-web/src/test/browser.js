import axe from 'axe-core';
import { page } from '@vitest/browser/context';
import { expect } from 'vitest';

export async function expectNoHorizontalOverflow(widths = [320, 768, 1280]) {
  const overflows = [];
  for (const width of widths) {
    await page.viewport(width, 900);
    const { scrollWidth } = document.documentElement;
    if (scrollWidth > window.innerWidth) overflows.push({ width, scrollWidth, innerWidth: window.innerWidth });
  }
  expect(overflows, 'horizontal overflow at one or more viewport widths').toEqual([]);
}

export async function expectNoAxeViolations(container = document.body) {
  const { violations } = await axe.run(container, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
  });
  expect(violations.map(({ id, help, nodes }) => ({
    id,
    help,
    targets: nodes.map(({ target }) => target),
  }))).toEqual([]);
}
