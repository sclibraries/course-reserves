import { act, createElement, useState } from 'react';
import { createRoot } from 'react-dom/client';
import PropTypes from 'prop-types';
import { fireEvent, getByRole } from '@testing-library/dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { toHaveNoViolations } from 'vitest-axe/matchers';
import { adminCourseService } from '../../../../services/admin/adminCourseService';
import AdminReuseForm from './AdminReuseForm';

expect.extend({ toHaveNoViolations });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const resource = {
  resource_id: 42,
  name: 'Synthetic reusable resource',
  material_type_name: 'Book',
  item_url: 'https://example.test/synthetic-resource',
};

function ReuseHarness({ onReuse }) {
  const [searchTerm, setSearchTerm] = useState('');

  return (
    <AdminReuseForm
      searchTerm={searchTerm}
      searchResults={[]}
      onSearchTermChange={setSearchTerm}
      onSearch={vi.fn()}
      onReuse={onReuse}
      isLoading={false}
    />
  );
}

ReuseHarness.propTypes = { onReuse: PropTypes.func.isRequired };

let container;
let root;

async function renderReuseForm(onReuse) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root.render(createElement(ReuseHarness, { onReuse })));
}

afterEach(() => {
  if (root) act(() => root.unmount());
  container?.remove();
  root = null;
  container = null;
  vi.restoreAllMocks();
});

describe('AdminReuseForm', () => {
  it('searches for a resource, adds it by id, and has no axe violations', async () => {
    vi.spyOn(adminCourseService, 'searchResources').mockResolvedValue({ resources: [resource] });
    const onReuse = vi.fn();
    await renderReuseForm(onReuse);

    await act(async () => fireEvent.change(getByRole(container, 'textbox', { name: 'Search resources' }), {
      target: { value: 'synthetic' },
    }));
    await act(async () => getByRole(container, 'button', { name: 'Search' }).click());

    expect(adminCourseService.searchResources).toHaveBeenCalledWith('synthetic');
    expect(getByRole(container, 'heading', { name: resource.name })).toBeTruthy();
    expect(await axe(container)).toHaveNoViolations();

    await act(async () => getByRole(container, 'button', { name: 'Add to Course' }).click());
    expect(onReuse).toHaveBeenCalledWith(42);
  });
});
