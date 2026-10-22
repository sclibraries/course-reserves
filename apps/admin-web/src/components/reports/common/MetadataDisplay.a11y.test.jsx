import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { getAllByRole, getByRole } from '@testing-library/dom';
import MetadataDisplay from './MetadataDisplay';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;

afterEach(() => {
  if (root) act(() => root.unmount());
  container?.remove();
  root = null;
  container = null;
  vi.useRealTimers();
});

it('opens metadata details from a named button and returns focus when closed', async () => {
  vi.useFakeTimers();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);

  await act(async () => {
    root.render(
      <MetadataDisplay
        metadata={{ query: 'biology reserves' }}
        eventType="search"
        showInline
        enhanced
      />,
    );
  });

  const button = getByRole(container, 'button', { name: 'Search: "biology reserves"' });

  await act(async () => button.focus());
  await act(async () => button.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  await act(async () => vi.runAllTimersAsync());
  const dialog = getByRole(document.body, 'dialog');
  expect(dialog.contains(document.activeElement)).toBe(true);
  expect(getByRole(dialog, 'heading', { name: 'Event Details - search' })).toBeTruthy();

  const closeButtons = getAllByRole(dialog, 'button', { name: 'Close' });
  await act(async () => closeButtons.at(-1).dispatchEvent(new MouseEvent('click', { bubbles: true })));
  await act(async () => vi.runAllTimersAsync());
  expect(dialog.isConnected).toBe(false);
  expect(document.activeElement).toBe(button);
});
