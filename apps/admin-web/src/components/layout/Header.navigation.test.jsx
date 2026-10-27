import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getByRole } from '@testing-library/dom';
import { MemoryRouter } from 'react-router-dom';

const mocks = vi.hoisted(() => ({
  useUnreadMessages: vi.fn(() => ({ unreadCount: 4 })),
  logout: vi.fn(),
}));

vi.mock('../../config/api.config', () => ({ apiConfig: { environment: 'production' } }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({
  isAuthenticated: true,
  logout: mocks.logout,
  user: { role: 'staff', username: 'devadmin', permissions: [] },
}) }));
vi.mock('../../hooks/useUnreadMessages', () => ({ default: mocks.useUnreadMessages }));
vi.mock('../../store/customizationStore', () => ({
  default: (selector) => selector({ currentCollege: 'default', getCustomizationForCollege: () => ({}) }),
}));
vi.mock('../../store/searchStore', () => ({ default: (selector) => selector({ setCollege: vi.fn() }) }));
vi.mock('../ui/LoginButton', () => ({ default: () => null }));

import Header from './Header';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;

afterEach(() => {
  if (root) act(() => root.unmount());
  container?.remove();
  root = null;
  container = null;
  mocks.useUnreadMessages.mockClear();
});

describe('Header admin navigation', () => {
  it('links to the admin landing page and shows mentions in production', async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root.render(<MemoryRouter><Header /></MemoryRouter>));

    expect(getByRole(container, 'link', { name: 'Go to admin page' }).getAttribute('href')).toBe('/admin');
    expect(getByRole(container, 'link', { name: '4 unread mentions' })).toBeTruthy();
    expect(mocks.useUnreadMessages).toHaveBeenCalledWith(30000, true);
  });
});
