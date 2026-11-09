import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import PropTypes from 'prop-types';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { page } from '@vitest/browser/context';
import { fireEvent, getByRole, waitFor } from '@testing-library/dom';
import { expectNoAxeViolations, expectNoHorizontalOverflow } from '../../../test/browser';
import ResourceFormManager from './ResourceFormManager';
import { ResourceFormType } from './constants/formTypes';

const mocks = vi.hoisted(() => ({
  createResource: vi.fn(),
  updateResource: vi.fn(),
  getMaterialTypes: vi.fn(),
  getMaterialTypeFields: vi.fn(),
  fetch: vi.fn(),
  folderManagementState: { folders: [], loading: false, error: null, createFolder: vi.fn() },
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
  adminResourceService: { updateResource: mocks.updateResource },
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

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const course = { offering_id: 'offering-17', course_id: 'course-17' };
let container;
let root;

function BrowserHarness({ initialData = {} }) {
  const [isOpen, setIsOpen] = useState(false);
  return <>
    <button type="button" onClick={() => setIsOpen(true)}>Open resource form</button>
    <ResourceFormManager
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
      formType={ResourceFormType.NEW}
      initialData={initialData}
      course={course}
      mode="course"
    />
  </>;
}

BrowserHarness.propTypes = { initialData: PropTypes.object };

async function renderForm(initialData) {
  await page.viewport(1280, 900);
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root.render(<BrowserHarness initialData={initialData} />));
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
});
