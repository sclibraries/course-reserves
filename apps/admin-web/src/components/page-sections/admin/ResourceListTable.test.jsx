import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LIBPROXY_PREFIX } from '../../../util/externalLinks';
import ResourceListTable from './ResourceListTable';

const mocks = vi.hoisted(() => ({
  updateResource: vi.fn(),
  deleteResource: vi.fn(),
  notifySuccess: vi.fn(),
  notifyFromError: vi.fn(),
}));

vi.mock('../../admin/forms/ResourceFormManager', () => ({
  default: ({ isOpen, onSubmit, initialData }) => isOpen
    ? <button onClick={async () => {
      const link = initialData.use_proxy === 1 || initialData.use_proxy === '1' || initialData.use_proxy === true
        ? `${LIBPROXY_PREFIX}${initialData.item_url.replace(LIBPROXY_PREFIX, '')}`
        : initialData.item_url.replace(LIBPROXY_PREFIX, '');
      await mocks.updateResource(initialData.resource_id, { link, use_proxy: initialData.use_proxy });
      onSubmit();
    }}>
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
vi.mock('../../../services/notify', () => ({
  notify: { success: mocks.notifySuccess, fromError: mocks.notifyFromError },
}));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;
let refreshResources;
let consoleError;

const mountTable = async (use_proxy = 0, item_url = 'https://example.test/item') => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  refreshResources = vi.fn();

  await act(async () => {
    root.render(createElement(ResourceListTable, {
      resources: [{
        resource_id: 'resource-1',
        name: 'Example resource',
        item_url,
        use_proxy,
      }],
      refreshResources,
    }));
  });
};

const render = async (use_proxy, item_url) => {
  await mountTable(use_proxy, item_url);

  const editButton = container.querySelector('[aria-label="Edit Example resource"]');
  await act(async () => editButton.dispatchEvent(new MouseEvent('click', { bubbles: true })));

  const saveButton = Array.from(container.querySelectorAll('button'))
    .find((button) => button.textContent.includes('Save resource'));
  await act(async () => saveButton.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  expect(mocks.updateResource).toHaveBeenCalledTimes(1);
  expect(refreshResources).toHaveBeenCalledTimes(1);
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.updateResource.mockResolvedValue({ resource_id: 'resource-1' });
  mocks.deleteResource.mockResolvedValue({});
});

afterEach(() => {
  consoleError?.mockRestore();
  consoleError = null;
  if (root) {
    act(() => root.unmount());
    root = null;
  }
  if (container) {
    container.remove();
    container = null;
  }
  refreshResources = null;
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

describe('ResourceListTable deletion feedback', () => {
  it('shows one success notification after deleting a resource', async () => {
    await mountTable();
    await act(async () => container.querySelector('[aria-label="Delete Example resource"]').click());
    await act(async () => {
      document.body.querySelector('[role="dialog"] button.btn-danger').click();
    });

    expect(mocks.deleteResource).toHaveBeenCalledTimes(1);
    expect(mocks.deleteResource).toHaveBeenCalledWith('resource-1');
    expect(mocks.notifySuccess).toHaveBeenCalledTimes(1);
    expect(mocks.notifySuccess).toHaveBeenCalledWith('Resource deleted');
    expect(refreshResources).toHaveBeenCalledTimes(1);
  });

  it('shows one generic notification when deletion fails', async () => {
    const error = Object.assign(new Error('Synthetic provider detail'), { reference: 'SYNTH-DELETE-1' });
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.deleteResource.mockRejectedValueOnce(error);
    await mountTable();
    await act(async () => container.querySelector('[aria-label="Delete Example resource"]').click());
    await act(async () => {
      document.body.querySelector('[role="dialog"] button.btn-danger').click();
    });

    expect(mocks.deleteResource).toHaveBeenCalledTimes(1);
    expect(mocks.notifyFromError).toHaveBeenCalledWith(error, "Couldn't delete the resource");
    expect(mocks.notifySuccess).not.toHaveBeenCalled();
  });
});
