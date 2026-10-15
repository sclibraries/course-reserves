import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LIBPROXY_PREFIX } from '../../../util/externalLinks';
import ResourceListTable from './ResourceListTable';

const mocks = vi.hoisted(() => ({
  updateResource: vi.fn(),
  deleteResource: vi.fn(),
}));

vi.mock('../../admin/forms/ResourceFormManager', () => ({
  default: ({ isOpen, onSubmit, initialData }) => isOpen
    ? <button onClick={() => onSubmit({
      resource_id: initialData.resource_id,
      link: initialData.item_url,
      use_proxy: initialData.use_proxy,
    })}>
      Save resource
    </button>
    : null,
}));

vi.mock('../../../services/admin/adminResourceService', () => ({
  adminResourceService: {
    updateResource: mocks.updateResource,
    deleteResource: mocks.deleteResource,
  },
}));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;

const render = async (use_proxy, item_url) => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);

  await act(async () => {
    root.render(createElement(ResourceListTable, {
      resources: [{
        resource_id: 'resource-1',
        name: 'Example resource',
        item_url,
        use_proxy,
      }],
      refreshResources: vi.fn(),
    }));
  });

  const editButton = container.querySelector('[aria-label="Edit Example resource"]');
  await act(async () => editButton.dispatchEvent(new MouseEvent('click', { bubbles: true })));

  const saveButton = Array.from(container.querySelectorAll('button'))
    .find((button) => button.textContent.includes('Save resource'));
  await act(async () => saveButton.dispatchEvent(new MouseEvent('click', { bubbles: true })));
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.updateResource.mockResolvedValue({ resource_id: 'resource-1' });
});

afterEach(() => {
  if (root) {
    act(() => root.unmount());
    root = null;
  }
  if (container) {
    container.remove();
    container = null;
  }
});

describe('ResourceListTable proxy handling', () => {
  it.each([1, '1', true])('adds the proxy prefix for enabled flag %s', async (use_proxy) => {
    await render(use_proxy, 'https://example.test/item');

    expect(mocks.updateResource).toHaveBeenCalledWith('resource-1', {
      link: `${LIBPROXY_PREFIX}https://example.test/item`,
      use_proxy,
    });
  });

  it.each([0, '0', false])('removes the proxy prefix for disabled flag %s', async (use_proxy) => {
    await render(use_proxy, `${LIBPROXY_PREFIX}https://example.test/item`);

    expect(mocks.updateResource).toHaveBeenCalledWith('resource-1', {
      link: 'https://example.test/item',
      use_proxy,
    });
  });
});
