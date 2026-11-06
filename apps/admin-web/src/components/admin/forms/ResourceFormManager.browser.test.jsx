import 'bootstrap/dist/css/bootstrap.min.css';
import '../../../../index.css';
import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { page } from '@vitest/browser/context';
import { fireEvent, getByRole, waitFor } from '@testing-library/dom';
import { expectNoAxeViolations, expectNoHorizontalOverflow } from '../../../../test/browser';
import ResourceFormManager from './ResourceFormManager';
import { ResourceFormType } from './constants/formTypes';

const mocks = vi.hoisted(() => ({
  createResource: vi.fn(),
  updateResource: vi.fn(),
  getMaterialTypes: vi.fn(),
  getMaterialTypeFields: vi.fn(),
  fetch: vi.fn(),
  notifySuccess: vi.fn(),
  notifyFromError: vi.fn(),
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
  useFolderManagement: () => ({ folders: [], loading: false, error: null, createFolder: vi.fn() }),
}));
vi.mock('../../../store/adminCourseStore', () => ({
  useAdminCourseStore: () => ({
    folioCourseData: {
      offering_id: 'folio-offering-17',
      course_id: 'folio-course-17',
      courseListingObject: {
        termObject: { startDate: '2026-09-01T00:00:00Z', endDate: '2026-12-20T00:00:00Z' },
      },
    },
    termStart: null,
    termEnd: null,
  }),
}));
vi.mock('../../../services/notify', () => ({
  notify: { success: mocks.notifySuccess, fromError: mocks.notifyFromError },
}));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const course = { offering_id: 'offering-17', course_id: 'course-17' };
let container;
let root;

function BrowserHarness() {
  const [isOpen, setIsOpen] = useState(false);
  return <>
    <button type="button" onClick={() => setIsOpen(true)}>Open resource form</button>
    <ResourceFormManager
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
      formType={ResourceFormType.NEW}
      course={course}
      mode="course"
    />
  </>;
}

async function renderForm() {
  await page.viewport(1280, 900);
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root.render(<BrowserHarness />));
  await act(async () => fireEvent.click(getByRole(container, 'button', { name: 'Open resource form' })));
}

afterEach(() => {
  if (root) act(() => root.unmount());
  container?.remove();
  root = null;
  container = null;
  vi.unstubAllGlobals();
});

describe('ResourceFormManager in Chromium', () => {
  it('keeps the long form and actions reachable at narrow widths and a short viewport height', async () => {
    vi.stubGlobal('fetch', mocks.fetch.mockImplementation(() => {
      throw new Error('Unexpected application HTTP request');
    }));
    mocks.getMaterialTypes.mockResolvedValue({ data: [] });
    mocks.getMaterialTypeFields.mockResolvedValue({ data: [] });
    mocks.createResource.mockResolvedValue({ resource_id: 'created-17' });
    mocks.updateResource.mockResolvedValue({ resource_id: 'resource-17' });
    await renderForm();

    const dialog = getByRole(document.body, 'dialog', { name: 'Add resource' });
    await expectNoHorizontalOverflow([320, 768, 1280]);
    await page.viewport(320, 480);

    const content = dialog.querySelector('[data-testid="resource-form-content"]');
    expect(content.scrollHeight).toBeGreaterThan(content.clientHeight);
    content.scrollTop = content.scrollHeight;
    const lastSection = dialog.querySelector('#visibility-settings');
    const contentBounds = content.getBoundingClientRect();
    expect(lastSection.getBoundingClientRect().bottom).toBeLessThanOrEqual(contentBounds.bottom);
    for (const name of ['Save', 'Cancel']) {
      const bounds = getByRole(dialog, 'button', { name }).getBoundingClientRect();
      expect(bounds.top).toBeGreaterThanOrEqual(0);
      expect(bounds.bottom).toBeLessThanOrEqual(window.innerHeight);
    }
    await expectNoAxeViolations(document.body);
    expect(mocks.fetch).not.toHaveBeenCalled();

    const opener = getByRole(container, 'button', { name: 'Open resource form' });
    fireEvent.keyDown(dialog, { key: 'Escape', code: 'Escape' });
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });
});
