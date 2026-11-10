import { act, createElement, useState } from 'react';
import { createRoot } from 'react-dom/client';
import PropTypes from 'prop-types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, getByRole, getByText, queryByRole, waitFor } from '@testing-library/dom';

const mocks = vi.hoisted(() => ({
  searchEDS: vi.fn(),
  searchEDSPage: vi.fn(),
  searchResources: vi.fn(),
  searchHitchcock: vi.fn(),
  mapEdsRecordToResource: vi.fn(),
  createResource: vi.fn(),
  updateResource: vi.fn(),
  fetch: vi.fn(),
  onReuse: vi.fn(),
  notifyFromError: vi.fn(),
  notifySuccess: vi.fn(),
  courseStoreState: {
    folioCourseData: {
      offering_id: 'stale-offering',
      course_id: 'stale-course',
      courseListingObject: { termObject: { startDate: '2026-01-01', endDate: '2026-05-01' } },
    },
  },
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
  adminCourseService: {
    searchEDS: mocks.searchEDS,
    searchEDSPage: mocks.searchEDSPage,
    searchResources: mocks.searchResources,
    createResource: mocks.createResource,
  },
}));
vi.mock('../../../services/admin/course/resourceApi', () => ({
  getEdsSearchErrorMessage: () => 'Unable to search the library right now. Please try again.',
}));
vi.mock('../../../services/admin/adminResourceService', () => ({
  adminResourceService: { updateResource: mocks.updateResource },
}));
vi.mock('../../../services/admin/hitchcockService', () => ({
  hitchcockService: { searchResources: mocks.searchHitchcock },
}));
vi.mock('../../../store/adminCourseStore', () => ({
  useAdminCourseStore: () => mocks.courseStoreState,
}));
vi.mock('../../../util/proxyUtil', () => ({ adjustProxy: (value) => value, LIBPROXY_PREFIX: '' }));
vi.mock('../../../util/mapEDSRecordToRespurce', () => ({ mapEdsRecordToResource: mocks.mapEdsRecordToResource }));
vi.mock('./resource-form/ResourceForm', () => ({
  default: ({ initialData, onSubmit, mode }) => <>
    <p>{initialData?.title}</p>
    <p data-mode={mode} />
    <button onClick={async () => {
      try {
        await onSubmit({ resource_id: 'test-resource', title: 'Updated item' });
      } catch {
        // The real form keeps the inline error visible after submission rejects.
      }
    }}>Save resource</button>
  </>,
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

function ControlledManager({ formType, onClose }) {
  const [isOpen, setIsOpen] = useState(true);
  return <ResourceFormManager
    isOpen={isOpen}
    onClose={() => {
      onClose();
      setIsOpen(false);
    }}
    formType={formType}
    mode="course"
  />;
}

ControlledManager.propTypes = {
  formType: PropTypes.oneOf(Object.values(ResourceFormType)).isRequired,
  onClose: PropTypes.func.isRequired,
};

describe('ResourceFormManager EDS search failures', () => {
  let container;
  let root;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.fetch.mockImplementation(() => { throw new Error('Unexpected application HTTP request'); });
    vi.stubGlobal('fetch', mocks.fetch);
    mocks.updateResource.mockResolvedValue({ resource_id: 'test-resource' });
    mocks.onReuse.mockResolvedValue(undefined);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    expect(mocks.fetch).not.toHaveBeenCalled();
    act(() => root.unmount());
    vi.unstubAllGlobals();
    container.remove();
    vi.restoreAllMocks();
  });

  it('sends EDS search failures with their reference to the error toast', async () => {
    const error = new Error(
      'Library search is temporarily unavailable. Please try again later, or add the item by citation.\nReference: 7F3K2Q'
    );
    mocks.searchEDS.mockRejectedValueOnce(error);

    await act(async () => {
      root.render(createElement(ResourceFormManager, {
        isOpen: true,
        onClose: vi.fn(),
        formType: ResourceFormType.EDS,
      }));
    });

    const input = getByRole(document.body, 'textbox', { name: 'Search EDS' });
    await act(async () => fireEvent.change(input, { target: { value: 'climate change' } }));
    await act(async () => getByRole(document.body, 'button', { name: 'Search' }).click());

    expect(mocks.searchEDS).toHaveBeenCalledWith('climate change');
    expect(mocks.notifyFromError).toHaveBeenCalledWith(error, "Couldn't search resources");
    expect(queryByRole(document.body, 'alert')).toBeNull();
  });

  it('returns to the same EDS results after filling the form through the mapper', async () => {
    const record = {
      An: 'SYNTH-AN-1',
      DbId: 'SYNTH-DB',
      Items: { Ti: [{ CleanData: 'Synthetic EDS title' }] },
    };
    mocks.searchEDS.mockResolvedValueOnce({
      status: 'success',
      code: 200,
      data: {
        records: [record],
        statistics: { TotalHits: 1, TotalSearchTime: 12 },
        request: { QueryString: 'climate change' },
      },
    });
    mocks.mapEdsRecordToResource.mockResolvedValueOnce({ title: 'Mapped synthetic title' });

    await act(async () => root.render(createElement(ResourceFormManager, {
      isOpen: true,
      onClose: vi.fn(),
      formType: ResourceFormType.EDS,
      mode: 'course',
    })));
    const input = getByRole(document.body, 'textbox', { name: 'Search EDS' });
    await act(async () => fireEvent.change(input, { target: { value: 'climate change' } }));
    await act(async () => getByRole(document.body, 'button', { name: 'Search' }).click());
    await act(async () => getByRole(document.body, 'button', { name: 'Edit & Add' }).click());

    expect(mocks.mapEdsRecordToResource).toHaveBeenCalledWith(record);
    expect(getByText(document.body, 'Mapped synthetic title')).toBeTruthy();
    expect(document.body.querySelector('[data-mode="course"]')).toBeTruthy();
    await act(async () => getByRole(document.body, 'button', { name: 'Back to results' }).click());

    expect(getByRole(document.body, 'textbox', { name: 'Search EDS' }).value).toBe('climate change');
    expect(getByRole(document.body, 'heading', { name: 'Synthetic EDS title' })).toBeTruthy();
    expect(mocks.searchEDS).toHaveBeenCalledTimes(1);
  });

  it('reports an EDS mapping failure through the shared error feedback', async () => {
    const error = Object.assign(new Error('Synthetic mapper failure'), { reference: 'SYNTH-EDS-9' });
    mocks.searchEDS.mockResolvedValueOnce({
      status: 'success',
      code: 200,
      data: {
        records: [{ An: 'SYNTH-AN-9', Items: { Ti: [{ CleanData: 'Synthetic EDS title' }] } }],
        statistics: { TotalHits: 1 },
        request: { QueryString: 'synthetic' },
      },
    });
    mocks.mapEdsRecordToResource.mockRejectedValueOnce(error);

    await act(async () => root.render(createElement(ResourceFormManager, {
      isOpen: true,
      onClose: vi.fn(),
      formType: ResourceFormType.EDS,
    })));
    const input = getByRole(document.body, 'textbox', { name: 'Search EDS' });
    await act(async () => fireEvent.change(input, { target: { value: 'synthetic' } }));
    await act(async () => fireEvent.click(getByRole(document.body, 'button', { name: 'Search' })));
    await act(async () => fireEvent.click(getByRole(document.body, 'button', { name: 'Edit & Add' })));

    expect(mocks.notifyFromError).toHaveBeenCalledExactlyOnceWith(error, "Couldn't fill the resource from EDS");
    expect(mocks.notifySuccess).not.toHaveBeenCalled();
  });

  it('forwards no-course mode even when course data is stale in the store', async () => {
    await act(async () => root.render(createElement(ResourceFormManager, {
      isOpen: true,
      onClose: vi.fn(),
      formType: ResourceFormType.EDIT,
      initialData: { resource_id: 'test-resource' },
      mode: 'none',
    })));

    expect(document.body.querySelector('[data-mode="none"]')).toBeTruthy();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it('uses the shared picker to search Hitchcock and render its results', async () => {
    const record = { id: 'SYNTH-HITCHCOCK-1', title: 'Synthetic Hitchcock title' };
    mocks.searchHitchcock.mockResolvedValueOnce({ ok: true, json: async () => [record] });

    await act(async () => root.render(createElement(ResourceFormManager, {
      isOpen: true,
      onClose: vi.fn(),
      formType: ResourceFormType.HITCHCOCK,
    })));
    const input = getByRole(document.body, 'textbox', { name: 'Search Hitchcock' });
    await act(async () => fireEvent.change(input, { target: { value: 'documentary' } }));
    await act(async () => getByRole(document.body, 'button', { name: 'Search' }).click());

    expect(mocks.searchHitchcock).toHaveBeenCalledWith('documentary');
    expect(getByRole(document.body, 'heading', { name: record.title })).toBeTruthy();
    expect(getByRole(document.body, 'button', { name: 'Edit & Add' })).toBeTruthy();
  });

  it.each([
    [ResourceFormType.EDS, 'Search EDS', mocks.searchEDS, {
      status: 'success',
      code: 200,
      data: { records: [{ An: 'SYNTH-CANCEL-EDS', Items: { Ti: [{ CleanData: 'Synthetic EDS result' }] } }] },
    }],
    [ResourceFormType.HITCHCOCK, 'Search Hitchcock', mocks.searchHitchcock, {
      ok: true,
      json: async () => [{ id: 'SYNTH-CANCEL-HITCHCOCK', title: 'Synthetic Hitchcock result' }],
    }],
  ])('%s closes after a pick when Cancel is pressed, without saving', async (formType, searchName, search, results) => {
    const onClose = vi.fn();
    search.mockResolvedValueOnce(results);
    mocks.mapEdsRecordToResource.mockResolvedValue({ title: 'Synthetic mapped result' });

    await act(async () => root.render(createElement(ControlledManager, { formType, onClose })));
    const input = getByRole(document.body, 'textbox', { name: searchName });
    await act(async () => fireEvent.change(input, { target: { value: 'synthetic query' } }));
    await act(async () => getByRole(document.body, 'button', { name: 'Search' }).click());
    await act(async () => getByRole(document.body, 'button', { name: 'Edit & Add' }).click());

    expect(getByRole(document.body, 'button', { name: 'Cancel' })).toBeTruthy();
    await act(async () => fireEvent.click(getByRole(document.body, 'button', { name: 'Cancel' })));

    await waitFor(() => expect(queryByRole(document.body, 'dialog')).toBeNull());
    expect(onClose).toHaveBeenCalledOnce();
    expect(mocks.createResource).not.toHaveBeenCalled();
    expect(mocks.updateResource).not.toHaveBeenCalled();
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

    await act(async () => getByRole(document.body, 'button', { name: 'Save resource' }).click());

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

    await act(async () => getByRole(document.body, 'button', { name: 'Save resource' }).click());

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

    await act(async () => getByRole(document.body, 'button', { name: 'Reuse resource' }).click());

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

    await act(async () => getByRole(document.body, 'button', { name: 'Reuse resource' }).click());

    expect(getByRole(document.body, 'alert').textContent).toBe("Couldn't add the resource to the course");
    expect(mocks.onReuse).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
    expect(mocks.notifyFromError).toHaveBeenCalledTimes(1);
    expect(mocks.notifyFromError).toHaveBeenCalledWith(error, "Couldn't link the resource");
    expect(mocks.notifySuccess).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
