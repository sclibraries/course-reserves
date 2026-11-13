import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getAllByRole, waitFor } from '@testing-library/dom';
import Searchbar from './Searchbar';
import HorizontalAdminSidebar from './HorizontalAdminSidebar';

const mocks = vi.hoisted(() => ({
  getDepartments: vi.fn(),
  auth: { user: { institution: 'Smith College' }, isAdmin: false },
  searchState: {
    college: 'smith', type: 'all', query: '', department: '', sortOption: '', sort: 'name',
    termId: null, terms: [{ id: 'SYNTH-TERM', name: 'Synthetic Term' }],
    setCollege: vi.fn(), setType: vi.fn(), setQuery: vi.fn(), setDepartment: vi.fn(),
    setSortOption: vi.fn(), setSort: vi.fn(), setTermId: vi.fn(), fetchTerms: vi.fn(),
  },
}));

vi.mock('../../services/folioSearchService', () => ({
  folioSearchService: { getDepartments: mocks.getDepartments, getInventory: vi.fn() },
}));
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => mocks.auth,
}));
vi.mock('../../store/searchStore', () => ({ default: () => mocks.searchState }));
vi.mock('../../store/adminSearchStore', () => ({ default: () => mocks.searchState }));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getDepartments.mockResolvedValue({ ok: false, json: async () => ({ data: { departments: [] } }) });
});

afterEach(() => {
  if (root) act(() => root.unmount());
  root = null;
  container?.remove();
  container = null;
});

describe('department load feedback', () => {
  it('shows an accessible message by each disabled department select after a failed response', async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root.render(createElement(MemoryRouter, null, createElement('main', null,
      createElement(Searchbar), createElement(HorizontalAdminSidebar),
    ))));

    await waitFor(() => expect(getAllByRole(container, 'alert')).toHaveLength(3));
    const selects = container.querySelectorAll('.search-panel-container #departmentSelect, .search-panel-container #mobileDepartmentSelect');
    expect(selects).toHaveLength(2);
    selects.forEach((select) => {
      expect(select.disabled).toBe(true);
      expect(select.parentElement.querySelector('label').textContent.trim()).toBe('Department');
      const message = select.nextElementSibling;
      expect(message.getAttribute('role')).toBe('alert');
      expect(message.id).toBe(select.getAttribute('aria-describedby'));
      expect(message.textContent.trim()).toBe('Could not load departments.');
    });
    expect(container.querySelector('.horizontal-admin-sidebar [role="alert"]').textContent.trim())
      .toBe('Could not load departments.');
    expect(mocks.getDepartments).toHaveBeenCalledTimes(2);
  });
});
