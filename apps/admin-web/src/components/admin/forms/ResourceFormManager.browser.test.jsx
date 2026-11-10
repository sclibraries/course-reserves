import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import PropTypes from 'prop-types';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { page } from '@vitest/browser/context';
import { fireEvent, getByRole, getByText, queryByRole, waitFor } from '@testing-library/dom';
import { expectNoAxeViolations, expectNoHorizontalOverflow } from '../../../test/browser';
import ResourceFormManager from './ResourceFormManager';
import { ResourceFormType } from './constants/formTypes';

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
  notifySuccess: vi.fn(),
  notifyFromError: vi.fn(),
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
  materialTypesResult: { data: [
    { material_type_id: '9', name: 'ebook', description: 'E-book' },
    { material_type_id: '10', name: 'article', description: 'Article' },
  ] },
  bookFields: [
    { field_name: 'book_title', field_type: 'text', label: 'Book title' },
    { field_name: 'publisher', field_type: 'text', label: 'Publisher' },
  ],
  materialTypeFieldsResult: { data: [] },
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
    mocks.getMaterialTypes.mockResolvedValue({ data: [] });
    mocks.getMaterialTypeFields.mockResolvedValue({ data: [] });
    const links = [1, 2, 3].map((number) => ({
      url: `https://example.test/${'long-path-segment-'.repeat(18)}${number}`,
      title: `Synthetic additional link ${number}`,
      description: '',
      use_proxy: false,
    }));
    await renderForm({ links });

    const dialog = getByRole(document.body, 'dialog', { name: 'Add resource' });
    for (const width of [320, 768, 1280]) {
      await page.viewport(width, 900);
      for (const number of [1, 2, 3]) {
        expect(getByRole(dialog, 'textbox', { name: `URL for link ${number}` }).value).toBe(links[number - 1].url);
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
    mocks.getMaterialTypes.mockResolvedValue({ data: [] });
    mocks.getMaterialTypeFields.mockResolvedValue({ data: [] });
    mocks.createResource.mockResolvedValue({ resource_id: 'created-17' });
    mocks.updateResource.mockResolvedValue({ resource_id: 'resource-17' });
    const opener = await renderForm();

    const dialog = getByRole(document.body, 'dialog', { name: 'Add resource' });
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
    mocks.getMaterialTypes.mockResolvedValue({ data: [] });
    mocks.getMaterialTypeFields.mockResolvedValue({ data: [] });
    mocks.getUsage.mockResolvedValue({
      course_count: 2,
      offering_count: 3,
      terms: [{ term_id: 7, term_name: 'Fall 2026' }, { term_id: 8, term_name: 'Spring 2027' }],
      linked_page_count: 3,
    });
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
        expect(bounds.left).toBeGreaterThanOrEqual(contentBounds.left);
        expect(bounds.right).toBeLessThanOrEqual(contentBounds.right);
        expect(bounds.top).toBeGreaterThanOrEqual(contentBounds.top);
        expect(bounds.bottom).toBeLessThanOrEqual(contentBounds.bottom);
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
});
