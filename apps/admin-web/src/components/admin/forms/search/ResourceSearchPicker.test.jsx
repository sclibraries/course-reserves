import { act, createElement, useState } from 'react';
import { createRoot } from 'react-dom/client';
import PropTypes from 'prop-types';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getByRole, queryByRole } from '@testing-library/dom';
import { axe } from 'vitest-axe';
import { toHaveNoViolations } from 'vitest-axe/matchers';
import { ResourceFormType } from '../constants/formTypes';
import ResourceSearchPicker from './ResourceSearchPicker';

expect.extend({ toHaveNoViolations });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const record = {
  An: 'SYNTH-AN-1',
  DbId: 'SYNTH-DB',
  DbLabel: 'Synthetic database',
  Items: { Ti: [{ CleanData: 'A long synthetic title for accessible search results' }] },
};

function PickerHarness({ initialResults = [], initiallySearched = false }) {
  const [searchTerm, setSearchTerm] = useState('climate change');
  const [searchResults, setSearchResults] = useState(initialResults);
  const [hasSearched, setHasSearched] = useState(initiallySearched);

  return (
    <ResourceSearchPicker
      formType={ResourceFormType.EDS}
      searchTerm={searchTerm}
      onSearchTermChange={setSearchTerm}
      onSearch={() => {
        setSearchResults([record]);
        setHasSearched(true);
      }}
      searchResults={searchResults}
      hasSearched={hasSearched}
      loading={false}
      totalHits={searchResults.length}
      searchTime={12}
      hasMore={false}
      onLoadMore={vi.fn()}
      onSelectRecord={vi.fn()}
    />
  );
}

PickerHarness.propTypes = {
  initialResults: PropTypes.arrayOf(PropTypes.object),
  initiallySearched: PropTypes.bool,
};

describe('ResourceSearchPicker', () => {
  let container;
  let root;

  async function renderPicker(props) {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root.render(createElement(PickerHarness, props)));
  }

  afterEach(() => {
    if (root) act(() => root.unmount());
    container?.remove();
    root = null;
    container = null;
  });

  it('submits the labelled search and renders result cards', async () => {
    await renderPicker();

    expect(getByRole(container, 'textbox', { name: 'Search EDS' })).toBeTruthy();
    await act(async () => getByRole(container, 'button', { name: 'Search' }).click());

    expect(getByRole(container, 'heading', { name: record.Items.Ti[0].CleanData })).toBeTruthy();
    expect(getByRole(container, 'button', { name: 'Edit & Add' })).toBeTruthy();
  });

  it('announces an empty result set without an alert', async () => {
    await renderPicker({ initiallySearched: true });

    expect(getByRole(container, 'status').textContent).toContain('No results');
    expect(queryByRole(container, 'alert')).toBeNull();
  });

  it('has no axe violations when results are shown', async () => {
    await renderPicker({ initialResults: [record], initiallySearched: true });

    expect(await axe(container)).toHaveNoViolations();
  });
});
