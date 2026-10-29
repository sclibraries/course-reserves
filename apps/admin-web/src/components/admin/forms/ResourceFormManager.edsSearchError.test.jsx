import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getByRole } from '@testing-library/dom';

const mocks = vi.hoisted(() => ({
  searchEDS: vi.fn(),
  updateResource: vi.fn(),
  onReuse: vi.fn(),
  notifyFromError: vi.fn(),
  notifySuccess: vi.fn(),
}));

vi.mock('reactstrap', async () => {
  const { default: PropTypes } = await import('prop-types');
  const Wrapper = ({ children }) => <div>{children}</div>;
  Wrapper.propTypes = { children: PropTypes.node };
  const Alert = ({ children, color, className, style }) => (
    <div role="alert" className={`alert alert-${color} ${className || ''}`} style={style}>{children}</div>
  );
  Alert.propTypes = {
    children: PropTypes.node,
    color: PropTypes.string,
    className: PropTypes.string,
    style: PropTypes.object,
  };
  const Button = ({ children, onClick, disabled }) => (
    <button type="button" onClick={onClick} disabled={disabled}>{children}</button>
  );
  Button.propTypes = {
    children: PropTypes.node,
    onClick: PropTypes.func,
    disabled: PropTypes.bool,
  };
  return {
    Modal: Wrapper,
    ModalHeader: Wrapper,
    ModalBody: Wrapper,
    Container: Wrapper,
    Row: Wrapper,
    Col: Wrapper,
    Card: Wrapper,
    CardBody: Wrapper,
    Table: Wrapper,
    Spinner: () => null,
    Alert,
    Button,
    ListGroup: Wrapper,
    ListGroupItem: Wrapper,
  };
});

vi.mock('../../../services/notify', () => ({
  notify: { fromError: mocks.notifyFromError, success: mocks.notifySuccess, error: vi.fn() },
}));
vi.mock('../../../services/admin/adminCourseService', () => ({
  adminCourseService: { searchEDS: mocks.searchEDS },
}));
vi.mock('../../../services/admin/course/resourceApi', () => ({
  getEdsSearchErrorMessage: () => 'Unable to search the library right now. Please try again.',
}));
vi.mock('../../../services/admin/adminResourceService', () => ({
  adminResourceService: { updateResource: mocks.updateResource },
}));
vi.mock('../../../services/admin/hitchcockService', () => ({ hitchcockService: {} }));
vi.mock('../../../store/adminCourseStore', () => ({ useAdminCourseStore: () => ({ folioCourseData: null }) }));
vi.mock('../../../util/proxyUtil', () => ({ adjustProxy: (value) => value, LIBPROXY_PREFIX: '' }));
vi.mock('../../../util/mapEDSRecordToRespurce', () => ({ mapEdsRecordToResource: vi.fn() }));
vi.mock('./common/BaseResourceForm', () => ({
  default: ({ onSubmit }) => <button onClick={async () => {
    try {
      await onSubmit({ resource_id: 'test-resource', title: 'Updated item' });
    } catch {
      // The real form keeps the inline error visible after submission rejects.
    }
  }}>Save resource</button>,
}));
vi.mock('./specialized/AdminReuseForm', async () => {
  const PropTypes = await import('prop-types');
  const AdminReuseForm = ({ error, onReuse }) => (
    <>
      {error && <div role="alert">{error}</div>}
      <button onClick={() => onReuse('test-resource')}>Reuse resource</button>
    </>
  );
  AdminReuseForm.propTypes = {
    error: PropTypes.string,
    onReuse: PropTypes.func.isRequired,
  };
  return { AdminReuseForm };
});
vi.mock('./specialized/CrosslinkForm', () => ({ CrossLinkForm: () => null }));

import ResourceFormManager from './ResourceFormManager';
import { ResourceFormType } from './constants/formTypes';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('ResourceFormManager EDS search failures', () => {
  let container;
  let root;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.updateResource.mockResolvedValue({ resource_id: 'test-resource' });
    mocks.onReuse.mockResolvedValue(undefined);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  it('shows the EDS reference on a separate line in the search alert', async () => {
    mocks.searchEDS.mockRejectedValueOnce(new Error(
      'Library search is temporarily unavailable. Please try again later, or add the item by citation.\nReference: 7F3K2Q'
    ));

    await act(async () => {
      root.render(createElement(ResourceFormManager, {
        isOpen: true,
        onClose: vi.fn(),
        formType: ResourceFormType.EDS,
      }));
    });

    const input = container.querySelector('input[placeholder="Enter search term..."]');
    const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    await act(async () => {
      valueSetter.call(input, 'climate change');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const searchButton = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent.trim() === 'Search');
    await act(async () => {
      searchButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    const alert = container.querySelector('[role="alert"]');
    expect(mocks.searchEDS).toHaveBeenCalledWith('climate change');
    expect(alert.textContent).toContain('Library search is temporarily unavailable.');
    expect(alert.textContent).toContain('Reference: 7F3K2Q');
    expect(alert.style.whiteSpace).toBe('pre-line');
  });

  it('saves an edited resource once and owns one success toast', async () => {
    const onSubmit = vi.fn();
    const onClose = vi.fn();
    await act(async () => root.render(createElement(ResourceFormManager, {
      isOpen: true,
      onClose,
      onSubmit,
      formType: ResourceFormType.EDIT,
      initialData: { resource_id: 'test-resource' },
    })));

    await act(async () => getByRole(container, 'button', { name: 'Save resource' }).click());

    expect(mocks.updateResource).toHaveBeenCalledTimes(1);
    expect(mocks.notifySuccess).toHaveBeenCalledTimes(1);
    expect(mocks.notifySuccess).toHaveBeenCalledWith('Resource updated');
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps an edited resource open and reports one generic failure toast', async () => {
    const error = Object.assign(new Error('Synthetic provider detail'), { reference: 'SYNTH-EDIT-1' });
    const onClose = vi.fn();
    mocks.updateResource.mockRejectedValueOnce(error);
    await act(async () => root.render(createElement(ResourceFormManager, {
      isOpen: true,
      onClose,
      formType: ResourceFormType.EDIT,
      initialData: { resource_id: 'test-resource' },
    })));

    await act(async () => getByRole(container, 'button', { name: 'Save resource' }).click());

    expect(mocks.updateResource).toHaveBeenCalledTimes(1);
    expect(mocks.notifyFromError).toHaveBeenCalledTimes(1);
    expect(mocks.notifyFromError).toHaveBeenCalledWith(error, "Couldn't save the resource");
    expect(mocks.notifySuccess).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('shows a reuse success once after the resource list refreshes', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    await act(async () => root.render(createElement(ResourceFormManager, {
      isOpen: true,
      onClose,
      onSubmit,
      onReuse: mocks.onReuse,
      formType: ResourceFormType.REUSE,
    })));

    await act(async () => getByRole(container, 'button', { name: 'Reuse resource' }).click());

    expect(mocks.onReuse).toHaveBeenCalledTimes(1);
    expect(mocks.onReuse).toHaveBeenCalledWith('test-resource');
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(mocks.notifySuccess).toHaveBeenCalledTimes(1);
    expect(mocks.notifySuccess).toHaveBeenCalledWith('Resource linked');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps a failed reuse open with an inline alert and one failure toast', async () => {
    const error = Object.assign(new Error('Synthetic provider detail'), { reference: 'SYNTH-REUSE-1' });
    const onSubmit = vi.fn();
    const onClose = vi.fn();
    mocks.onReuse.mockRejectedValueOnce(error);
    await act(async () => root.render(createElement(ResourceFormManager, {
      isOpen: true,
      onClose,
      onSubmit,
      onReuse: mocks.onReuse,
      formType: ResourceFormType.REUSE,
    })));

    await act(async () => getByRole(container, 'button', { name: 'Reuse resource' }).click());

    expect(getByRole(container, 'alert').textContent).toBe("Couldn't add the resource to the course");
    expect(mocks.onReuse).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
    expect(mocks.notifyFromError).toHaveBeenCalledTimes(1);
    expect(mocks.notifyFromError).toHaveBeenCalledWith(error, "Couldn't link the resource");
    expect(mocks.notifySuccess).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
