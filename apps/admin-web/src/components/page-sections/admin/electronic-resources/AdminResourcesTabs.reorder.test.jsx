import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, getByRole } from '@testing-library/dom';
import AdminResourcesTabs from './AdminResourcesTabs';

const mocks = vi.hoisted(() => ({
  notify: {
    success: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
    fromError: vi.fn(),
  },
  toUserError: vi.fn(),
  updateUnifiedResourceOrder: vi.fn(),
  fetchResources: vi.fn(),
  unlinkResource: vi.fn(),
  rejected: vi.fn(),
}));

vi.mock('../../../../services/notify', () => ({ notify: mocks.notify, toUserError: mocks.toUserError }));
vi.mock('../../../../store/adminResourceStore', () => ({
  useAdminResourceStore: () => ({
    resources: [{ resource_id: 'synthetic-1', course_resource_id: 101, name: 'Synthetic resource', order: 1 }],
    printResources: [], linkedCourses: [], fetchResources: mocks.fetchResources,
    unlinkResource: mocks.unlinkResource, updateUnifiedResourceOrder: mocks.updateUnifiedResourceOrder,
  }),
}));
vi.mock('../../admin/UnifiedResourceTable', () => ({
  default: ({ onReorder }) => (
    <button type="button" onClick={() => onReorder({ electronic: [], print: [] }).catch(mocks.rejected)}>
      Attempt reorder
    </button>
  ),
}));
vi.mock('./AdminResourceActions', () => ({ default: () => null }));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;

afterEach(() => {
  vi.clearAllMocks();
  if (root) act(() => root.unmount());
  root = null;
  container?.remove();
  container = null;
});

describe('AdminResourcesTabs reorder validation', () => {
  it('shows an error and rejects the reorder when course identifiers are missing', async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    const unused = () => {};
    await act(async () => root.render(createElement(AdminResourcesTabs, {
      course: {},
      toggleNewResourceModal: unused,
      toggleEDSResourceModal: unused,
      toggleHitchcockModal: unused,
      toggleReuseModal: unused,
      toggleCrossLinkModal: unused,
      buildFolioCourseUrl: unused,
      navigate: unused,
      editResourceModal: { openEditResourceForm: unused },
    })));

    await act(async () => fireEvent.click(getByRole(container, 'button', { name: 'Attempt reorder' })));

    expect(mocks.notify.error).toHaveBeenCalledTimes(1);
    expect(mocks.notify.error).toHaveBeenCalledWith("Couldn't update the resource order");
    expect(mocks.rejected).toHaveBeenCalledWith(expect.objectContaining({ message: 'Missing course identifiers for resource order' }));
    expect(mocks.updateUnifiedResourceOrder).not.toHaveBeenCalled();
  });
});
