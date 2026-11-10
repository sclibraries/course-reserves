import { act, createElement, useState } from 'react';
import { createRoot } from 'react-dom/client';
import PropTypes from 'prop-types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { toHaveNoViolations } from 'vitest-axe/matchers';
import { fireEvent, getAllByRole, getByLabelText, getByRole, queryByLabelText, queryByRole, waitFor } from '@testing-library/dom';
import ResourceFormManager from './ResourceFormManager';
import { ResourceFormType } from './constants/formTypes';
import { LIBPROXY_PREFIX } from '../../../util/proxyUtil';

expect.extend({ toHaveNoViolations });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  createResource: vi.fn(),
  searchEDS: vi.fn(),
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
  proxyFieldsResult: { data: [
    { field_name: 'peer_reviewed', field_type: 'checkbox', label: 'Peer reviewed' },
    { field_name: 'open_access', field_type: 'checkbox', label: 'Open access' },
  ] },
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
  adminCourseService: { createResource: mocks.createResource, searchEDS: mocks.searchEDS },
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
  it.each([
    {
      name: 'flag 0 with item dates',
      material_type_id: '1',
      fields: {
        start_visibility: '2026-09-01', end_visibility: '2026-12-20', use_resource_visibility: 0,
        primary_link_start_visibility: null, primary_link_end_visibility: null, use_primary_link_visibility: 0,
      },
      links: [{
        url: 'https://example.test/dormant-item', title: 'Synthetic additional link', description: '', use_proxy: 0,
        start_visibility: '2026-09-03', end_visibility: '2026-12-18', use_link_visibility: 0,
      }],
    },
    {
      name: 'flag 1 with undated item and primary link',
      material_type_id: '1',
      fields: {
        start_visibility: null, end_visibility: null, use_resource_visibility: 1,
        primary_link_start_visibility: null, primary_link_end_visibility: null, use_primary_link_visibility: 1,
      },
      links: [],
    },
    {
      name: 'one-sided item, primary, and additional-link windows',
      material_type_id: '1',
      fields: {
        start_visibility: '2026-09-01', end_visibility: null, use_resource_visibility: 1,
        primary_link_start_visibility: null, primary_link_end_visibility: '2026-12-18', use_primary_link_visibility: 1,
      },
      links: [{
        url: 'https://example.test/one-sided', title: 'Synthetic one-sided link', description: '', use_proxy: 0,
        start_visibility: '2026-09-03', end_visibility: null, use_link_visibility: 1,
      }],
    },
    {
      name: 'an undated video',
      material_type_id: '3',
      fields: {
        start_visibility: null, end_visibility: null, use_resource_visibility: 0,
        primary_link_start_visibility: null, primary_link_end_visibility: null, use_primary_link_visibility: 0,
      },
      links: [],
    },
    {
      name: 'dormant primary and additional-link dates',
      material_type_id: '1',
      fields: {
        start_visibility: null, end_visibility: null, use_resource_visibility: 0,
        primary_link_start_visibility: '2026-09-02', primary_link_end_visibility: '2026-12-19', use_primary_link_visibility: 0,
      },
      links: [{
        url: 'https://example.test/dormant-link', title: 'Synthetic dormant link', description: '', use_proxy: 0,
        start_visibility: '2026-09-04', end_visibility: '2026-12-17', use_link_visibility: 0,
      }],
    },
  ])('preserves all loaded visibility fields after a name-only edit with $name', async ({ material_type_id, fields, links }) => {
    await renderForm({
      formType: ResourceFormType.EDIT,
      initialData: {
        resource_id: 'resource-17', name: 'Loaded synthetic resource', item_url: 'https://example.test/primary',
        material_type_id, links, ...fields,
      },
    });

    const dialog = getByRole(document.body, 'dialog', { name: 'Edit resource' });
    fireEvent.change(getByRole(dialog, 'textbox', { name: 'Resource Name' }), {
      target: { value: 'Renamed synthetic resource' },
    });
    await act(async () => fireEvent.click(getByRole(dialog, 'button', { name: 'Save' })));
    await waitFor(() => expect(mocks.updateResource).toHaveBeenCalledOnce());

    const payload = mocks.updateResource.mock.calls[0][1];
    expect(Object.fromEntries(Object.keys(fields).map((field) => [field, payload[field]]))).toEqual(fields);
    expect(payload.links).toEqual(links);
  });

  it('shows only shared additional-link dates in no-course mode and keeps the section axe-clean', async () => {
    await renderForm({
      formType: ResourceFormType.EDIT,
      mode: 'none',
      initialData: {
        resource_id: 'resource-17', name: 'Synthetic resource', item_url: 'https://example.test/primary',
        start_visibility: '2026-09-01', end_visibility: '2026-12-20', use_resource_visibility: 1,
        use_primary_link_visibility: 1, primary_link_start_visibility: '2026-09-02',
        primary_link_end_visibility: '2026-12-19',
        links: [{
          url: 'https://example.test/shared', title: 'Synthetic shared link', description: '', use_proxy: 0,
          start_visibility: '2026-09-03', end_visibility: '2026-12-18', use_link_visibility: 1,
        }],
      },
    });

    const dialog = getByRole(document.body, 'dialog', { name: 'Edit resource' });
    const visibility = getByRole(dialog, 'region', { name: 'When can students see it?' });
    expect(queryByRole(visibility, 'checkbox', { name: 'Show this item between' })).toBeNull();
    expect(queryByRole(visibility, 'checkbox', { name: 'Primary link only between' })).toBeNull();
    expect(queryByLabelText(visibility, /item start date/i)).toBeNull();
    expect(queryByLabelText(visibility, /primary link start date/i)).toBeNull();
    expect(getByLabelText(visibility, /link 1 start date/i).value).toBe('2026-09-03');
    expect(visibility.textContent).toContain('Applies in every course using this resource.');
    expect(await axe(visibility)).toHaveNoViolations();
  });

  it('does not change additional-link dates when a primary-link date changes', async () => {
    await renderForm({
      formType: ResourceFormType.EDIT,
      initialData: {
        resource_id: 'resource-17', name: 'Synthetic resource', item_url: 'https://example.test/primary',
        use_primary_link_visibility: 1, primary_link_start_visibility: '2026-09-01',
        links: [{
          url: 'https://example.test/additional', title: 'Synthetic additional link', description: '', use_proxy: 0,
          start_visibility: '2026-09-05', end_visibility: '2026-12-05', use_link_visibility: 1,
        }],
      },
    });

    const dialog = getByRole(document.body, 'dialog', { name: 'Edit resource' });
    fireEvent.change(getByLabelText(dialog, /primary link start date/i), { target: { value: '2026-10-01' } });
    await act(async () => fireEvent.click(getByRole(dialog, 'button', { name: 'Save' })));
    await waitFor(() => expect(mocks.updateResource).toHaveBeenCalledOnce());

    expect(mocks.updateResource.mock.calls[0][1].links[0]).toMatchObject({
      start_visibility: '2026-09-05', end_visibility: '2026-12-05',
    });
  });

  it('saves checkbox metadata and preserves proxy URLs per link', async () => {
    const prefix = LIBPROXY_PREFIX;
    const links = [
      { url: `${prefix}https://example.test/untouched`, title: 'Untouched', use_proxy: 0 },
      { url: `${prefix}https://example.test/original`, title: 'Edited', use_proxy: 0 },
      { url: `${prefix}https://example.test/disabled`, title: 'Disabled', use_proxy: 1 },
      { url: 'https://proxy.example.test/item', title: 'Proxy host', use_proxy: 0 },
    ];
    mocks.getMaterialTypeFields.mockResolvedValue(mocks.proxyFieldsResult);

    await renderForm({
      formType: ResourceFormType.EDIT,
      initialData: {
        resource_id: 'resource-17',
        name: 'Synthetic resource',
        item_url: `${prefix}https://example.test/primary`,
        use_proxy: 0,
        material_type_id: '9',
        metadata: [
          { field_name: 'peer_reviewed', field_value: 'No' },
          { field_name: 'open_access', field_value: 'Yes' },
        ],
        links,
      },
    });

    const dialog = getByRole(document.body, 'dialog', { name: 'Edit resource' });
    const linkSection = getByRole(dialog, 'region', { name: 'Where do students go?' });
    expect(getByRole(linkSection, 'textbox', { name: 'Primary URL' }).value).toBe('https://example.test/primary');
    expect(getByRole(linkSection, 'checkbox', { name: 'Use proxy for this resource' }).checked).toBe(true);
    expect(getByRole(linkSection, 'checkbox', { name: 'Use proxy for link 1' }).checked).toBe(true);
    expect(getByRole(linkSection, 'checkbox', { name: 'Use proxy for link 4' }).checked).toBe(false);
    expect(getByRole(dialog, 'checkbox', { name: 'Peer reviewed' }).checked).toBe(false);
    expect(getByRole(dialog, 'checkbox', { name: 'Open access' }).checked).toBe(true);
    expect(await axe(linkSection)).toHaveNoViolations();

    await act(async () => fireEvent.change(getByRole(linkSection, 'textbox', { name: 'URL for link 2' }), {
      target: { value: 'https://example.test/edited' },
    }));
    await act(async () => fireEvent.click(getByRole(linkSection, 'checkbox', { name: 'Use proxy for link 3' })));
    await act(async () => fireEvent.click(getByRole(dialog, 'checkbox', { name: 'Peer reviewed' })));
    await act(async () => fireEvent.click(getByRole(dialog, 'checkbox', { name: 'Open access' })));
    await act(async () => fireEvent.click(getByRole(dialog, 'button', { name: 'Save' })));

    const payload = mocks.updateResource.mock.calls[0][1];
    expect(payload.metadata).toMatchObject({ peer_reviewed: 'Yes', open_access: 'No' });
    expect(payload.link).toBe(`${prefix}https://example.test/primary`);
    expect(payload.links.map(({ url }) => url)).toEqual([
      links[0].url,
      `${prefix}https://example.test/edited`,
      'https://example.test/disabled',
      links[3].url,
    ]);
  });

  it('keeps proxy enabled when changing an EDS record and prefixes the replacement link on save', async () => {
    mocks.getMaterialTypes.mockResolvedValue({ data: [{ material_type_id: '9', name: 'ebook' }] });
    mocks.searchEDS.mockResolvedValue({
      status: 'success',
      code: 200,
      data: {
        records: [{
          pubType: 'Academic Journal',
          An: 'SYNTH-AN-18',
          DbId: 'SYNTH-DB-18',
          DbLabel: 'Synthetic database',
          PLink: 'https://example.test/record',
          FullTextCustomLinks: [{ Url: 'https://example.test/new-eds' }],
          Items: {
            Ti: [{ Label: 'Title', Group: 'Ti', Data: 'Synthetic replacement', CleanData: ['Synthetic replacement'] }],
            Au: [],
            Ab: [],
          },
          RecordInfo: { BibEntity: { Identifiers: [] } },
        }],
        statistics: { TotalHits: 1 },
        request: { QueryString: 'replacement' },
      },
    });
    await renderForm({
      formType: ResourceFormType.EDIT,
      initialData: {
        resource_id: 'resource-18',
        name: 'Loaded synthetic resource',
        item_url: 'https://example.test/loaded',
        use_proxy: 1,
        material_type_id: '9',
        metadata: [{ field_name: 'accession_number', field_value: 'SYNTH-AN-OLD' }],
      },
    });

    const dialog = getByRole(document.body, 'dialog', { name: 'Edit resource' });
    const changeRecordButton = getByRole(dialog, 'button', { name: 'Change record' });
    changeRecordButton.focus();
    await act(async () => fireEvent.click(changeRecordButton));

    const search = getByRole(dialog, 'textbox', { name: 'Search EDS' });
    await act(async () => fireEvent.change(search, { target: { value: 'replacement' } }));
    await act(async () => fireEvent.click(getByRole(dialog, 'button', { name: 'Search' })));
    await act(async () => fireEvent.click(getByRole(dialog, 'button', { name: 'Edit & Add' })));
    await waitFor(() => expect(getByRole(dialog, 'textbox', { name: 'Primary URL' }).value)
      .toBe('https://example.test/new-eds'));
    expect(getByRole(dialog, 'checkbox', { name: 'Use proxy for this resource' }).checked).toBe(true);

    await act(async () => fireEvent.click(getByRole(dialog, 'button', { name: 'Save' })));

    expect(mocks.updateResource.mock.calls[0][1].link)
      .toBe(`${LIBPROXY_PREFIX}https://example.test/new-eds`);
  });

  it('keeps ebook metadata and Description when the fields endpoint has no definitions', async () => {
    const record = {
      pubType: 'Ebook',
      DbId: 'SYNTH-DB-9',
      DbLabel: 'Synthetic ebook database',
      An: 'SYNTH-AN-9',
      PLink: 'https://example.test/ebook',
      Items: {
        Ti: [{ Label: 'Title', Group: 'Ti', Data: 'Synthetic ebook title', CleanData: ['Synthetic ebook title'] }],
        Au: [{ Label: 'Author', Group: 'Au', Data: 'Author', CleanData: ['Synthetic ebook author'] }],
        Ab: [{ Label: 'Abstract', Group: 'Ab', Data: 'Abstract', CleanData: ['Description from EDS'] }],
      },
      RecordInfo: {
        BibEntity: { Identifiers: [{ Type: 'ISBN-13', Value: '9780000000009' }] },
      },
    };
    mocks.searchEDS.mockResolvedValueOnce({
      status: 'success',
      code: 200,
      data: { records: [record], statistics: { TotalHits: 1 }, request: { QueryString: 'ebook' } },
    });
    mocks.getMaterialTypes.mockResolvedValue({ data: [{ material_type_id: '9', name: 'ebook' }] });
    mocks.getMaterialTypeFields.mockResolvedValue({ data: [] });

    await renderForm({ formType: ResourceFormType.EDS });
    const dialog = getByRole(document.body, 'dialog', { name: 'Add from EDS' });
    await act(async () => fireEvent.change(getByRole(dialog, 'textbox', { name: 'Search EDS' }), {
      target: { value: 'ebook' },
    }));
    await act(async () => fireEvent.click(getByRole(dialog, 'button', { name: 'Search' })));
    await act(async () => fireEvent.click(getByRole(dialog, 'button', { name: 'Edit & Add' })));

    await waitFor(() => expect(getByRole(dialog, 'textbox', { name: 'Description' }).value).toBe('Description from EDS'));
    expect(getByRole(dialog, 'textbox', { name: 'Resource Name' }).value).toBe('Synthetic ebook title');
    expect(mocks.getMaterialTypeFields).toHaveBeenCalledExactlyOnceWith(9);
    expect(dialog.textContent).not.toContain('Failed to load material type fields');
    expect(mocks.notifyFromError).not.toHaveBeenCalled();
    expect(mocks.notifySuccess).toHaveBeenCalledExactlyOnceWith('Resource details filled from EDS');

    await act(async () => fireEvent.click(getByRole(dialog, 'button', { name: 'Save' })));

    const saved = mocks.createResource.mock.calls[0][2];
    expect(saved.metadata).toMatchObject({
      book_title: 'Synthetic ebook title',
      author_editor: 'Synthetic ebook author',
      isbn: '9780000000009',
      is_ebook: true,
    });
  });

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
    for (const id of ['what-is-it', 'what-students-see', 'when-can-students-see-it', 'staff-only']) {
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
        use_resource_visibility: 1,
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
    const startDate = getByLabelText(dialog, 'Link 1 start date');
    const endDate = getByLabelText(dialog, 'Link 1 end date');
    fireEvent.change(linkUrl, { target: { value: 'https://example.test/unsaved' } });
    fireEvent.change(startDate, { target: { value: '2026-10-01' } });
    fireEvent.change(endDate, { target: { value: '2026-11-01' } });
    fireEvent.click(getByRole(dialog, 'checkbox', { name: 'Link 1 only between' }));
    fireEvent.click(cancel);

    await waitFor(() => expect(queryByRole(document.body, 'dialog')).toBeNull());
    expect(mocks.createResource).not.toHaveBeenCalled();
    expect(mocks.updateResource).not.toHaveBeenCalled();
    await act(async () => fireEvent.click(getByRole(container, 'button', { name: 'Open resource form' })));

    dialog = getByRole(document.body, 'dialog', { name: 'Edit resource' });
    expect(getByLabelText(dialog, /^URL/).value).toBe('https://example.test/original');
    expect(getByLabelText(dialog, 'Link 1 start date').value).toBe('2026-09-05');
    expect(getByLabelText(dialog, 'Link 1 end date').value).toBe('2026-12-05');
    expect(getByRole(dialog, 'checkbox', { name: 'Link 1 only between' }).checked).toBe(true);
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
