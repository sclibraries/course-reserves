import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import PropTypes from 'prop-types';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { page } from '@vitest/browser/context';
import { fireEvent, getByRole, getByText, queryByRole, waitFor } from '@testing-library/dom';
import { expectNoAxeViolations, expectNoHorizontalOverflow } from '../../../test/browser';
import ResourceFormManager from './ResourceFormManager';
import { ResourceFormType } from './constants/formTypes';
import { Toaster } from '../../ui/sonner';
import { LIBPROXY_PREFIX } from '../../../util/proxyUtil';

const mocks = vi.hoisted(() => ({
  createResource: vi.fn(),
  updateResource: vi.fn(),
  searchEDS: vi.fn(),
  mapEdsRecordToResource: vi.fn(),
  getUsage: vi.fn(),
  getMaterialTypes: vi.fn(),
  getMaterialTypeFields: vi.fn(),
  fetch: vi.fn(),
  folderManagementState: { folders: [], loading: false, error: null, createFolder: vi.fn() },
  edsSearchResult: {
    status: 'success',
    code: 200,
    data: {
      records: [{
        title: 'Synthetic EDS source title',
        pubType: 'E-Book',
        DbId: 'SYNTH-DB-22',
        DbLabel: 'Synthetic EDS database',
        An: 'SYNTH-AN-22',
        Items: {
          Ti: [{ CleanData: ['Synthetic EDS source title'] }],
          Au: [{ CleanData: ['Synthetic EDS author'] }],
        },
      }],
      statistics: { TotalHits: 1 },
      request: { QueryString: 'synthetic record' },
    },
  },
  mappedEdsRecord: {
    title: 'Synthetic EDS source title',
    link: 'https://example.test/eds/synthetic-22',
    material_type: '9',
    metadata: {
      book_title: 'Synthetic EDS source title',
      publisher: 'Synthetic EDS press',
      database: 'Synthetic EDS database',
      accession_number: 'SYNTH-AN-22',
      is_ebook: false,
      doi: '10.5555/synthetic.22',
    },
  },
  changedEdsRecord: {
    title: 'Synthetic replacement title',
    link: 'https://example.test/eds/synthetic-replacement',
    material_type: '9',
    description: 'Synthetic replacement abstract',
    metadata: {
      publisher: 'Synthetic replacement press',
      accession_number: 'SYNTH-AN-23',
    },
  },
  materialTypesResult: { data: [
    { material_type_id: '9', name: 'ebook', description: 'E-book' },
    { material_type_id: '10', name: 'article', description: 'Article' },
  ] },
  bookFields: [
    { field_name: 'book_title', field_type: 'text', label: 'Book title' },
    { field_name: 'publisher', field_type: 'text', label: 'Publisher' },
  ],
  materialTypeFieldsResult: { data: [] },
  usageResult: {
    course_count: 1,
    offering_count: 1,
    terms: [],
    linked_page_count: 0,
  },
  detailedUsageResult: {
    course_count: 2,
    offering_count: 3,
    terms: [{ term_id: 7, term_name: 'Fall 2026' }, { term_id: 8, term_name: 'Spring 2027' }],
    linked_page_count: 3,
  },
  createdResourceResult: { resource_id: 'created-17' },
  savedResourceResult: { resource_id: 'resource-17' },
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
vi.mock('../../../util/mapEDSRecordToRespurce', () => ({
  mapEdsRecordToResource: mocks.mapEdsRecordToResource,
}));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const course = { offering_id: 'offering-17', course_id: 'course-17' };
let container;
let root;

function BrowserHarness({ initialData = {}, formType = ResourceFormType.NEW }) {
  const [isOpen, setIsOpen] = useState(false);
  return <>
    <button type="button" onClick={() => setIsOpen(true)}>Open resource form</button>
    <Toaster />
    <ResourceFormManager
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
      formType={formType}
      initialData={initialData}
      course={course}
      mode="course"
    />
  </>;
}

BrowserHarness.propTypes = {
  initialData: PropTypes.object,
  formType: PropTypes.oneOf(Object.values(ResourceFormType)),
};

async function renderForm(initialData, formType) {
  await page.viewport(1280, 900);
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root.render(<BrowserHarness initialData={initialData} formType={formType} />));
  const opener = getByRole(container, 'button', { name: 'Open resource form' });
  opener.focus();
  await act(async () => fireEvent.click(opener));
  return opener;
}

afterEach(() => {
  if (root) act(() => root.unmount());
  container?.remove();
  root = null;
  container = null;
  vi.unstubAllGlobals();
});

describe('ResourceFormManager in Chromium', () => {
  it('reflows three long additional links across supported widths', async () => {
    vi.stubGlobal('fetch', mocks.fetch.mockImplementation(() => {
      throw new Error('Unexpected application HTTP request');
    }));
    mocks.getMaterialTypes.mockResolvedValue(mocks.materialTypesResult);
    mocks.getMaterialTypeFields.mockResolvedValue(mocks.materialTypeFieldsResult);
    const prefix = LIBPROXY_PREFIX;
    const links = [1, 2, 3].map((number) => ({
      url: `${number === 1 ? prefix : ''}https://example.test/${'long-path-segment-'.repeat(18)}${number}`,
      title: `Synthetic additional link ${number}`,
      description: '',
      use_proxy: number === 1 ? 0 : false,
    }));
    await renderForm({ link: `${prefix}https://example.test/primary`, use_proxy: 0, links });

    const dialog = getByRole(document.body, 'dialog', { name: 'Add resource' });
    const linkSection = getByRole(dialog, 'region', { name: 'Where do students go?' });
    for (const width of [320, 768, 1280]) {
      await page.viewport(width, 900);
      expect(getByRole(linkSection, 'textbox', { name: 'Primary URL' }).value).toBe('https://example.test/primary');
      expect(getByRole(linkSection, 'checkbox', { name: 'Use proxy for this resource' }).checked).toBe(true);
      for (const number of [1, 2, 3]) {
        const expectedUrl = number === 1 ? links[number - 1].url.slice(prefix.length) : links[number - 1].url;
        expect(getByRole(linkSection, 'textbox', { name: `URL for link ${number}` }).value).toBe(expectedUrl);
      }
    }
    await expectNoHorizontalOverflow([320, 768, 1280]);
    await expectNoAxeViolations(document.body);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it('keeps the long form accessible across supported widths', async () => {
    vi.stubGlobal('fetch', mocks.fetch.mockImplementation(() => {
      throw new Error('Unexpected application HTTP request');
    }));
    mocks.getMaterialTypes.mockResolvedValue(mocks.materialTypesResult);
    mocks.getMaterialTypeFields.mockResolvedValue(mocks.materialTypeFieldsResult);
    mocks.createResource.mockResolvedValue(mocks.createdResourceResult);
    mocks.updateResource.mockResolvedValue(mocks.savedResourceResult);
    const opener = await renderForm();

    const dialog = getByRole(document.body, 'dialog', { name: 'Add resource' });
    expect(queryByRole(dialog, 'button', { name: 'Change record' })).toBeNull();
    await expectNoHorizontalOverflow([320, 768, 1280]);
    for (const width of [320, 768, 1280]) {
      await page.viewport(width, 900);
      for (const heading of ['What is it?', 'What do students see?', 'Staff only']) {
        expect(getByRole(dialog, 'heading', { name: heading })).toBeTruthy();
      }
    }
    await expectNoAxeViolations(document.body);
    expect(mocks.fetch).not.toHaveBeenCalled();

    await page.viewport(320, 480);
    const content = dialog.querySelector('[data-testid="resource-form-content"]');
    expect(content.scrollHeight).toBeGreaterThan(content.clientHeight);
    const actionButtons = ['Save', 'Cancel'].map(name => getByRole(dialog, 'button', { name }));
    const actionTops = actionButtons.map(button => button.getBoundingClientRect().top);
    expect(actionButtons.every(button => !content.contains(button))).toBe(true);
    content.scrollTop = content.scrollHeight;
    const lastSection = dialog.querySelector('#staff-only');
    const contentBounds = content.getBoundingClientRect();
    const lastSectionBounds = lastSection.getBoundingClientRect();
    expect(lastSectionBounds.top).toBeGreaterThanOrEqual(contentBounds.top);
    expect(lastSectionBounds.bottom).toBeLessThanOrEqual(contentBounds.bottom);
    const footer = actionButtons[0].closest('footer') || actionButtons[0].parentElement;
    const form = content.querySelector('form');
    const diagnostic = Object.fromEntries(Object.entries({ dialog, content, footer, form }).map(([name, element]) => {
      const { top, bottom, height } = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return [name, {
        className: element.className,
        rect: { top, bottom, height },
        style: {
          display: style.display,
          height: style.height,
          maxHeight: style.maxHeight,
          overflowY: style.overflowY,
          position: style.position,
        },
      }];
    }));
    diagnostic.windowInnerHeight = window.innerHeight;
    diagnostic.documentClientHeight = document.documentElement.clientHeight;
    const diagnosticMessage = JSON.stringify(diagnostic);
    actionButtons.forEach((button, index) => {
      const bounds = button.getBoundingClientRect();
      expect(bounds.top).toBeGreaterThanOrEqual(0);
      expect(bounds.bottom, diagnosticMessage).toBeLessThanOrEqual(window.innerHeight);
      expect(bounds.top).toBe(actionTops[index]);
    });

    fireEvent.keyDown(dialog, { key: 'Escape', code: 'Escape' });
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });

  it('shows the edit usage warning and required-name summary at supported widths', async () => {
    vi.stubGlobal('fetch', mocks.fetch.mockImplementation(() => {
      throw new Error('Unexpected application HTTP request');
    }));
    mocks.getMaterialTypes.mockResolvedValue(mocks.materialTypesResult);
    mocks.getMaterialTypeFields.mockResolvedValue(mocks.materialTypeFieldsResult);
    mocks.getUsage.mockResolvedValue(mocks.detailedUsageResult);
    const opener = await renderForm({ resource_id: 'resource-17', name: '' }, ResourceFormType.EDIT);

    const dialog = getByRole(document.body, 'dialog', { name: 'Edit resource' });
    await waitFor(() => expect(getByRole(dialog, 'status').textContent).toContain(
      'Used in 2 courses (Fall 2026, Spring 2027) - changes apply to all, and up to 3 linked pages',
    ));
    await act(async () => fireEvent.click(getByRole(dialog, 'button', { name: 'Save' })));

    const summary = getByRole(dialog, 'alert', { name: 'Please correct the following:' });
    const warning = getByRole(dialog, 'status');
    const nameField = getByRole(dialog, 'textbox', { name: 'Resource Name' });
    expect(nameField.getAttribute('aria-describedby')).toBe('title-error');
    await act(async () => fireEvent.click(getByRole(summary, 'link', { name: 'Resource name is required' })));
    expect(document.activeElement).toBe(nameField);

    const content = dialog.querySelector('[data-testid="resource-form-content"]');
    for (const width of [320, 768, 1280]) {
      await page.viewport(width, 900);
      for (const element of [warning, summary]) {
        element.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        const bounds = element.getBoundingClientRect();
        const contentBounds = content.getBoundingClientRect();
        expect(bounds.width).toBeGreaterThan(0);
        expect(bounds.height).toBeGreaterThan(0);
        // Allow 1 px for sub-pixel rounding after scrollIntoView.
        expect(bounds.left).toBeGreaterThanOrEqual(contentBounds.left - 1);
        expect(bounds.right).toBeLessThanOrEqual(contentBounds.right + 1);
        expect(bounds.top).toBeGreaterThanOrEqual(contentBounds.top - 1);
        expect(bounds.bottom).toBeLessThanOrEqual(contentBounds.bottom + 1);
      }
      expect(summary.textContent).toContain('Resource name is required');
      expect(warning.textContent).toContain('Used in 2 courses');
    }
    await expectNoHorizontalOverflow([320, 768, 1280]);
    await expectNoAxeViolations(summary);
    await expectNoAxeViolations(warning);
    expect(mocks.updateResource).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();

    fireEvent.keyDown(dialog, { key: 'Escape', code: 'Escape' });
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });

  it('collapses the EDS source strip on phones and shows its full details on desktop', async () => {
    vi.stubGlobal('fetch', mocks.fetch.mockImplementation(() => {
      throw new Error('Unexpected application HTTP request');
    }));
    mocks.getMaterialTypes.mockResolvedValue(mocks.materialTypesResult);
    mocks.getMaterialTypeFields.mockImplementation((typeId) => {
      mocks.materialTypeFieldsResult.data = String(typeId) === '9' ? mocks.bookFields : [];
      return Promise.resolve(mocks.materialTypeFieldsResult);
    });
    mocks.searchEDS.mockResolvedValue(mocks.edsSearchResult);
    mocks.mapEdsRecordToResource.mockResolvedValue(mocks.mappedEdsRecord);
    await renderForm({}, ResourceFormType.EDS);

    const dialog = getByRole(document.body, 'dialog', { name: 'Add from EDS' });
    await act(async () => fireEvent.change(getByRole(dialog, 'textbox', { name: 'Search EDS' }), {
      target: { value: 'synthetic record' },
    }));
    await act(async () => fireEvent.click(getByRole(dialog, 'button', { name: 'Search' })));
    await act(async () => fireEvent.click(getByRole(dialog, 'button', { name: 'Edit & Add' })));

    const source = getByRole(dialog, 'region', { name: 'Resource source' });
    const linkSection = getByRole(dialog, 'region', { name: 'Where do students go?' });
    const typeFields = getByRole(dialog, 'region', { name: 'Type-specific fields' });
    expect(getByRole(source, 'button', { name: 'Change record' })).toBeTruthy();
    const mobileDetails = source.querySelector('details');
    const mobileSummary = source.querySelector('summary');
    const desktopText = source.querySelector('p.md\\:tw-block');
    await waitFor(() => expect(mobileDetails).toBeTruthy());
    await waitFor(() => expect(getByRole(typeFields, 'textbox', { name: /Publisher.*from EDS/ })).toBeTruthy());
    const guessedLink = getByRole(dialog, 'textbox', { name: /Primary URL.*guessed/ });
    const guessedType = getByRole(dialog, 'combobox', { name: /Material Type.*guessed/ });
    const publisher = getByRole(typeFields, 'textbox', { name: /Publisher.*from EDS/ });
    expect(getByRole(dialog, 'region', { name: 'Other details' }).textContent).toContain('from EDS');
    expect(getByRole(typeFields, 'textbox', { name: /Book title.*from EDS/ })).toBeTruthy();
    await expectNoAxeViolations(typeFields);
    for (const width of [320, 768, 1280]) {
      await page.viewport(width, 900);
      await expectNoHorizontalOverflow([width]);
      if (width === 320) {
        expect(mobileDetails.open).toBe(false);
        expect(mobileSummary).toBeTruthy();
        expect(getComputedStyle(desktopText).display).toBe('none');
        await act(async () => fireEvent.click(mobileSummary));
        expect(mobileDetails.open).toBe(true);
        expect(mobileDetails.textContent).toContain('Synthetic EDS database');
      }
      if (width === 1280) {
        expect(getComputedStyle(mobileDetails).display).toBe('none');
        expect(getComputedStyle(desktopText).display).not.toBe('none');
        expect(desktopText.textContent).toBe('From EDS: Synthetic EDS source title · Synthetic EDS database · AN SYNTH-AN-22');
      }
    }
    await expectNoAxeViolations(linkSection);
    await act(async () => fireEvent.change(publisher, { target: { value: 'Manually edited press' } }));
    await waitFor(() => expect(queryByRole(typeFields, 'textbox', { name: /Publisher.*from EDS/ })).toBeNull());
    await act(async () => fireEvent.change(guessedType, { target: { value: '10' } }));
    await waitFor(() => expect(queryByRole(dialog, 'combobox', { name: /Material Type.*guessed/ })).toBeNull());
    expect(guessedType.value).toBe('10');
    const otherDetails = getByRole(dialog, 'region', { name: 'Other details' });
    await waitFor(() => expect(otherDetails.textContent).toContain('Manually edited press'));
    expect(getByText(otherDetails, 'article title')).toBeTruthy();
    expect(getByText(otherDetails, 'Synthetic EDS source title')).toBeTruthy();
    await act(async () => fireEvent.change(guessedLink, { target: { value: 'https://example.test/edited-link' } }));
    await waitFor(() => expect(queryByRole(dialog, 'textbox', { name: /Primary URL.*guessed/ })).toBeNull());
    await expectNoHorizontalOverflow([320, 768, 1280]);
    await expectNoAxeViolations(source);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it('changes a saved EDS record while keeping edits and clearing saved metadata', async () => {
    vi.stubGlobal('fetch', mocks.fetch.mockImplementation(() => {
      throw new Error('Unexpected application HTTP request');
    }));
    mocks.getMaterialTypes.mockResolvedValue(mocks.materialTypesResult);
    mocks.getMaterialTypeFields.mockResolvedValue(mocks.materialTypeFieldsResult);
    mocks.getUsage.mockResolvedValue(mocks.usageResult);
    mocks.searchEDS.mockResolvedValue(mocks.edsSearchResult);
    mocks.mapEdsRecordToResource.mockResolvedValue(mocks.changedEdsRecord);
    mocks.updateResource.mockResolvedValue(mocks.savedResourceResult);
    mocks.updateResource.mockClear();
    const opener = await renderForm({
      resource_id: 'resource-17',
      name: 'Loaded synthetic title',
      item_url: 'https://example.test/loaded-resource',
      material_type_id: '9',
      metadata: [
        { field_name: 'database', field_value: 'Synthetic saved database' },
        { field_name: 'publisher', field_value: 'Synthetic saved press' },
        { field_name: 'accession_number', field_value: 'SYNTH-AN-OLD' },
      ],
    }, ResourceFormType.EDIT);

    const dialog = getByRole(document.body, 'dialog', { name: 'Edit resource' });
    const title = getByRole(dialog, 'textbox', { name: 'Resource Name' });
    await act(async () => fireEvent.change(title, { target: { value: 'Staff-edited title' } }));
    const changeButton = getByRole(dialog, 'button', { name: 'Change record' });
    changeButton.focus();
    await act(async () => fireEvent.click(changeButton));

    const search = getByRole(dialog, 'textbox', { name: 'Search EDS' });
    await waitFor(() => expect(document.activeElement).toBe(search));
    for (const width of [320, 768, 1280]) {
      await page.viewport(width, 900);
      await expectNoHorizontalOverflow([width]);
    }
    await expectNoAxeViolations(document.body);

    await act(async () => fireEvent.change(search, { target: { value: 'replacement record' } }));
    await act(async () => fireEvent.click(getByRole(dialog, 'button', { name: 'Search' })));
    await waitFor(() => expect(getByRole(dialog, 'button', { name: 'Edit & Add' })).toBeTruthy());
    await act(async () => fireEvent.click(getByRole(dialog, 'button', { name: 'Edit & Add' })));

    const source = getByRole(dialog, 'region', { name: 'Resource source' });
    await waitFor(() => expect(getByRole(source, 'status').textContent).toBe('Kept your edits: Title'));
    await waitFor(() => expect(getByText(document.body, 'Resource details replaced from EDS')).toBeTruthy());
    await act(async () => fireEvent.click(getByRole(dialog, 'button', { name: 'Save' })));
    await waitFor(() => expect(mocks.updateResource).toHaveBeenCalledOnce());

    const [, payload] = mocks.updateResource.mock.calls.at(-1);
    expect(payload.title).toBe('Staff-edited title');
    expect(payload.metadata.database).toBeNull();
    expect(payload.metadata.accession_number).toBe('SYNTH-AN-23');
    expect(payload.metadata.publisher).toBe('Synthetic replacement press');
    expect(payload.metadata).not.toHaveProperty('isbn');
    expect(mocks.fetch).not.toHaveBeenCalled();
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });
});
