import { act, createElement, useState } from 'react';
import { createRoot } from 'react-dom/client';
import PropTypes from 'prop-types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { toHaveNoViolations } from 'vitest-axe/matchers';
import { fireEvent, getAllByRole, getByLabelText, getByRole, queryByRole, waitFor } from '@testing-library/dom';
import ResourceFormManager from './ResourceFormManager';
import { ResourceFormType } from './constants/formTypes';

expect.extend({ toHaveNoViolations });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  createResource: vi.fn(),
  updateResource: vi.fn(),
  getUsage: vi.fn(),
  getMaterialTypes: vi.fn(),
  getMaterialTypeFields: vi.fn(),
  fetch: vi.fn(),
  folderManagementState: {
    folders: [{ folder_id: 'folder-17', name: 'Synthetic folder' }],
    loading: false,
    error: null,
    createFolder: vi.fn(),
  },
  notifySuccess: vi.fn(),
  notifyFromError: vi.fn(),
  courseStoreState: {
    folioCourseData: {
      offering_id: 'folio-offering-17',
      course_id: 'folio-course-17',
      courseListingObject: {
        termObject: { startDate: '2026-09-01T00:00:00Z', endDate: '2026-12-20T00:00:00Z' },
      },
    },
    termStart: null,
    termEnd: null,
  },
}));

vi.mock('../../../services/admin/adminCourseService', () => ({
  adminCourseService: { createResource: mocks.createResource },
}));
vi.mock('../../../services/admin/adminResourceService', () => ({
  adminResourceService: { getUsage: mocks.getUsage, updateResource: mocks.updateResource },
}));
vi.mock('../../../services/admin/adminMaterialTypeService', () => ({
  adminMaterialTypeService: {
    getMaterialTypes: mocks.getMaterialTypes,
    getMaterialTypeFields: mocks.getMaterialTypeFields,
  },
}));
vi.mock('../../../hooks/useFolderManagement', () => ({
  useFolderManagement: () => mocks.folderManagementState,
}));
vi.mock('../../../store/adminCourseStore', () => ({
  useAdminCourseStore: () => mocks.courseStoreState,
}));
vi.mock('../../../services/notify', () => ({
  notify: { success: mocks.notifySuccess, fromError: mocks.notifyFromError },
}));

const courseData = mocks.courseStoreState.folioCourseData;
const course = { offering_id: 'offering-17', course_id: 'course-17' };

function FormHarness({ formType, initialData, onSubmit = vi.fn(), mode = 'course' }) {
  const [isOpen, setIsOpen] = useState(true);
  return <>
    <button type="button" onClick={() => setIsOpen(true)}>Open resource form</button>
    <ResourceFormManager
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
      onSubmit={onSubmit}
      formType={formType}
      initialData={initialData}
      course={course}
      mode={mode}
    />
  </>;
}

FormHarness.propTypes = {
  formType: PropTypes.oneOf(Object.values(ResourceFormType)).isRequired,
  initialData: PropTypes.object,
  onSubmit: PropTypes.func,
  mode: PropTypes.oneOf(['course', 'none']),
};

let container;
let root;

async function renderForm(props) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root.render(createElement(FormHarness, props)));
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createResource.mockResolvedValue({ resource_id: 'created-17' });
  mocks.updateResource.mockResolvedValue({ resource_id: 'resource-17' });
  mocks.getUsage.mockResolvedValue({
    course_count: 2,
    offering_count: 3,
    terms: [{ term_id: 7, term_name: 'Fall 2026' }, { term_id: 8, term_name: 'Spring 2027' }],
    linked_page_count: 3,
  });
  mocks.getMaterialTypes.mockResolvedValue({ data: [] });
  mocks.getMaterialTypeFields.mockResolvedValue({ data: [] });
  mocks.fetch.mockImplementation(() => { throw new Error('Unexpected application HTTP request'); });
  vi.stubGlobal('fetch', mocks.fetch);
});

afterEach(() => {
  if (root) act(() => root.unmount());
  container?.remove();
  root = null;
  container = null;
  vi.unstubAllGlobals();
});

describe('ResourceFormManager dialog shell', () => {
  it('creates a resource with the existing payload and exposes one accessible title, Save, Cancel, and an axe-clean form', async () => {
    await renderForm({ formType: ResourceFormType.NEW });

    const dialog = getByRole(document.body, 'dialog', { name: 'Add resource' });
    expect(getAllByRole(dialog, 'heading', { name: 'Add resource' })).toHaveLength(1);
    const headings = getAllByRole(dialog, 'heading').map((heading) => heading.textContent.trim());
    expect(headings).toContain('What is it?');
    expect(headings).toContain('What do students see?');
    expect(headings).toContain('Staff only');
    expect(headings.indexOf('What is it?')).toBeLessThan(headings.indexOf('What do students see?'));
    expect(headings.indexOf('What do students see?')).toBeLessThan(headings.indexOf('Staff only'));
    expect(getByRole(dialog, 'combobox', { name: 'Material Type' })).toBeTruthy();
    expect(getByRole(dialog, 'textbox', { name: 'Resource Name' })).toBeTruthy();
    expect(getByRole(dialog, 'textbox', { name: 'Description' })).toBeTruthy();
    expect(getByRole(dialog, 'textbox', { name: 'Note for students' })).toBeTruthy();
    expect(getByRole(dialog, 'combobox', { name: 'Folder' })).toBeTruthy();
    expect(getByRole(dialog, 'textbox', { name: 'Internal note' })).toBeTruthy();
    expect(getByRole(dialog, 'button', { name: 'Save' })).toBeTruthy();
    expect(getByRole(dialog, 'button', { name: 'Cancel' })).toBeTruthy();
    for (const id of ['what-is-it', 'what-students-see', 'staff-only']) {
      expect(await axe(dialog.querySelector(`#${id}`), {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
      })).toHaveNoViolations();
    }
    expect(await axe(document.body, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
    })).toHaveNoViolations();

    fireEvent.change(getByRole(dialog, 'textbox', { name: 'Resource Name' }), {
      target: { value: 'Synthetic manual resource' },
    });
    fireEvent.change(getByRole(dialog, 'combobox', { name: 'Folder' }), {
      target: { value: 'folder-17' },
    });
    await act(async () => fireEvent.click(getByRole(dialog, 'button', { name: 'Save' })));

    expect(mocks.createResource).toHaveBeenCalledExactlyOnceWith(
      'offering-17',
      'course-17',
      {
        title: 'Synthetic manual resource',
        link: '',
        use_proxy: 0,
        notes: '',
        internal_note: '',
        external_note: '',
        folder: 'folder-17',
        start_visibility: '2026-09-01',
        end_visibility: '2026-12-20',
        material_type_id: '',
        metadata: {},
        use_primary_link_visibility: 0,
        primary_link_start_visibility: '',
        primary_link_end_visibility: '',
        links: [],
      },
      courseData,
    );
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it('cancels an edit without saving and restores the original additional-link values when reopened', async () => {
    const initialData = {
      resource_id: 'resource-17',
      name: 'Synthetic existing resource',
      links: [{
        url: 'https://example.test/original',
        title: 'Synthetic reference',
        description: '',
        use_proxy: false,
        start_visibility: '2026-09-05',
        end_visibility: '2026-12-05',
        use_link_visibility: true,
      }],
    };
    await renderForm({ formType: ResourceFormType.EDIT, initialData });

    let dialog = getByRole(document.body, 'dialog', { name: 'Edit resource' });
    expect(getAllByRole(dialog, 'heading', { name: 'Edit resource' })).toHaveLength(1);
    expect(getByRole(dialog, 'button', { name: 'Save' })).toBeTruthy();
    const cancel = getByRole(dialog, 'button', { name: 'Cancel' });
    const linkUrl = getByLabelText(dialog, /^URL/);
    const [startDate, endDate] = dialog.querySelectorAll('input[type="date"]');
    fireEvent.change(linkUrl, { target: { value: 'https://example.test/unsaved' } });
    fireEvent.change(startDate, { target: { value: '2026-10-01' } });
    fireEvent.change(endDate, { target: { value: '2026-11-01' } });
    fireEvent.click(getByRole(dialog, 'checkbox', { name: 'Set separate visibility dates for this link' }));
    fireEvent.click(cancel);

    await waitFor(() => expect(queryByRole(document.body, 'dialog')).toBeNull());
    expect(mocks.createResource).not.toHaveBeenCalled();
    expect(mocks.updateResource).not.toHaveBeenCalled();
    await act(async () => fireEvent.click(getByRole(container, 'button', { name: 'Open resource form' })));

    dialog = getByRole(document.body, 'dialog', { name: 'Edit resource' });
    expect(getByLabelText(dialog, /^URL/).value).toBe('https://example.test/original');
    const reopenedDates = dialog.querySelectorAll('input[type="date"]');
    expect(reopenedDates[0].value).toBe('2026-09-05');
    expect(reopenedDates[1].value).toBe('2026-12-05');
    expect(getByRole(dialog, 'checkbox', { name: 'Set separate visibility dates for this link' }).checked).toBe(true);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it('shows the required-name error inline and in a summary link that focuses the field without submitting', async () => {
    const onSubmit = vi.fn();
    await renderForm({ formType: ResourceFormType.NEW, onSubmit });

    const dialog = getByRole(document.body, 'dialog', { name: 'Add resource' });
    const nameField = getByRole(dialog, 'textbox', { name: 'Resource Name' });
    await act(async () => fireEvent.click(getByRole(dialog, 'button', { name: 'Save' })));

    expect(nameField.getAttribute('aria-describedby')).toBe('title-error');
    const summary = getByRole(dialog, 'alert', { name: 'Please correct the following:' });
    const summaryLink = getByRole(summary, 'link', { name: 'Resource name is required' });
    expect(dialog.querySelector('#resource-form').lastElementChild).toBe(summary);
    expect(summary.textContent).toContain('Resource name is required');
    expect(await axe(summary, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
    })).toHaveNoViolations();

    await act(async () => fireEvent.click(summaryLink));

    expect(document.activeElement).toBe(nameField);
    expect(onSubmit).not.toHaveBeenCalled();
    expect(mocks.createResource).not.toHaveBeenCalled();
    expect(mocks.getUsage).not.toHaveBeenCalled();
    expect(dialog.textContent).not.toContain('Used in');
  });

  it('shows edit usage counts and linked pages in an accessible shared-fields warning', async () => {
    await renderForm({
      formType: ResourceFormType.EDIT,
      initialData: { resource_id: 'resource-17', name: 'Synthetic existing resource' },
    });

    const dialog = getByRole(document.body, 'dialog', { name: 'Edit resource' });
    await waitFor(() => expect(getByRole(dialog, 'status').textContent).toContain(
      'Used in 2 courses (Fall 2026, Spring 2027) - changes apply to all, and up to 3 linked pages',
    ));
    const warning = getByRole(dialog, 'status');
    const folder = getByRole(dialog, 'combobox', { name: 'Folder' });
    expect(mocks.getUsage).toHaveBeenCalledExactlyOnceWith('resource-17');
    expect(warning.compareDocumentPosition(folder) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(await axe(warning, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
    })).toHaveNoViolations();
  });

  it('announces usage loading and failure without showing a zero count, and toasts the error reference', async () => {
    let rejectUsage;
    mocks.getUsage.mockReturnValue(new Promise((resolve, reject) => {
      rejectUsage = reject;
    }));
    await renderForm({
      formType: ResourceFormType.EDIT,
      initialData: { resource_id: 'resource-17', name: 'Synthetic existing resource' },
    });

    const dialog = getByRole(document.body, 'dialog', { name: 'Edit resource' });
    expect(getByRole(dialog, 'status').textContent).toContain('Checking resource usage');
    expect(dialog.textContent).not.toContain('0 courses');

    const error = Object.assign(new Error('Synthetic usage failure'), { reference: 'SYNTH-USAGE-17' });
    await act(async () => rejectUsage(error));
    await waitFor(() => expect(dialog.textContent).toContain("Resource usage couldn't be checked"));

    expect(dialog.textContent).not.toContain('0 courses');
    expect(mocks.notifyFromError).toHaveBeenCalledExactlyOnceWith(error, "Couldn't check resource usage");
  });

  it('reports incomplete usage data as unavailable instead of rendering an invalid warning', async () => {
    mocks.getUsage.mockResolvedValue({
      terms: null,
      linked_page_count: 0,
      reference: 'SYNTH-USAGE-INCOMPLETE',
    });
    await renderForm({
      formType: ResourceFormType.EDIT,
      initialData: { resource_id: 'resource-17', name: 'Synthetic existing resource' },
    });

    const dialog = getByRole(document.body, 'dialog', { name: 'Edit resource' });
    await waitFor(() => expect(dialog.textContent).toContain("Resource usage couldn't be checked"));

    expect(dialog.textContent).not.toContain('undefined courses');
    expect(dialog.textContent).not.toContain('0 courses');
    expect(mocks.notifyFromError).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ reference: 'SYNTH-USAGE-INCOMPLETE' }),
      "Couldn't check resource usage",
    );
  });

  it.each([
    {
      invalidField: 'Publisher',
      initialData: { name: 'Synthetic resource', material_type_id: '2' },
      materialTypeFields: [{ field_name: 'publisher', field_type: 'text', label: 'Publisher', required: true }],
    },
    {
      invalidField: 'URL for link 1',
      initialData: {
        name: 'Synthetic resource',
        links: [{ url: 'not a url', title: 'Synthetic link', description: '', use_proxy: false }],
      },
      materialTypeFields: [],
    },
  ])('still blocks saves when $invalidField is invalid', async ({ invalidField, initialData, materialTypeFields }) => {
    mocks.getMaterialTypeFields.mockResolvedValue({ data: materialTypeFields });
    await renderForm({ formType: ResourceFormType.NEW, initialData });

    const dialog = getByRole(document.body, 'dialog', { name: 'Add resource' });
    const field = getByRole(dialog, 'textbox', { name: invalidField });
    await waitFor(() => expect(field.required).toBe(true));
    expect(field.checkValidity()).toBe(false);
    await act(async () => fireEvent.click(getByRole(dialog, 'button', { name: 'Save' })));

    expect(mocks.createResource).not.toHaveBeenCalled();
  });
});
