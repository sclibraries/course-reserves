import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  searchEDS: vi.fn(),
  toastError: vi.fn(),
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

vi.mock('react-toastify', () => ({ toast: { error: mocks.toastError, success: vi.fn() } }));
vi.mock('../../../services/admin/adminCourseService', () => ({
  adminCourseService: { searchEDS: mocks.searchEDS },
}));
vi.mock('../../../services/admin/course/resourceApi', () => ({
  getEdsSearchErrorMessage: () => 'Unable to search the library right now. Please try again.',
}));
vi.mock('../../../services/admin/adminResourceService', () => ({ adminResourceService: {} }));
vi.mock('../../../services/admin/hitchcockService', () => ({ hitchcockService: {} }));
vi.mock('../../../store/adminCourseStore', () => ({ useAdminCourseStore: () => ({ folioCourseData: null }) }));
vi.mock('../../../util/proxyUtil', () => ({ adjustProxy: (value) => value, LIBPROXY_PREFIX: '' }));
vi.mock('../../../util/mapEDSRecordToRespurce', () => ({ mapEdsRecordToResource: vi.fn() }));
vi.mock('./common/BaseResourceForm', () => ({ default: () => null }));
vi.mock('./specialized/AdminReuseForm', () => ({ AdminReuseForm: () => null }));
vi.mock('./specialized/CrosslinkForm', () => ({ CrossLinkForm: () => null }));

import ResourceFormManager from './ResourceFormManager';
import { ResourceFormType } from './constants/formTypes';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('ResourceFormManager EDS search failures', () => {
  let container;
  let root;

  beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
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
});
