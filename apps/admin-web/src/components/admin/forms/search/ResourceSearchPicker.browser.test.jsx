import 'bootstrap/dist/css/bootstrap.min.css';
import '../../../../index.css';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { page } from '@vitest/browser/context';
import { getByRole } from '@testing-library/dom';
import { expectNoAxeViolations, expectNoHorizontalOverflow } from '../../../../test/browser';
import { ResourceFormType } from '../constants/formTypes';
import ResourceSearchPicker from './ResourceSearchPicker';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const record = {
  An: 'SYNTH-AN-2',
  DbId: 'SYNTH-DB',
  DbLabel: 'Synthetic database',
  Items: {
    Ti: [{ CleanData: `${'Synthetic long title with many words '.repeat(18)}without spaces ${'x'.repeat(80)}` }],
  },
};

let container;
let root;

async function renderPicker() {
  await page.viewport(1280, 900);
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root.render(
    <ResourceSearchPicker
      formType={ResourceFormType.EDS}
      searchTerm="long title"
      onSearchTermChange={vi.fn()}
      onSearch={vi.fn()}
      searchResults={[record]}
      hasSearched
      loading={false}
      totalHits={1}
      searchTime={12}
      hasMore={false}
      onLoadMore={vi.fn()}
      onSelectRecord={vi.fn()}
    />,
  ));
}

afterEach(() => {
  if (root) act(() => root.unmount());
  container?.remove();
  root = null;
  container = null;
});

describe('ResourceSearchPicker in Chromium', () => {
  it('wraps long titles, reflows without page overflow, and has no axe violations', async () => {
    await renderPicker();

    const title = getByRole(container, 'heading', { name: /Synthetic long title/ });
    await expectNoHorizontalOverflow([320, 768, 1280]);
    await page.viewport(320, 900);
    expect(title.scrollWidth).toBeLessThanOrEqual(title.clientWidth);
    await expectNoAxeViolations(container);
  });
});
