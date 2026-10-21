import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it } from 'vitest';
import MetadataDisplay from './MetadataDisplay';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;

afterEach(() => {
  if (root) act(() => root.unmount());
  container?.remove();
  root = null;
  container = null;
});

it('opens inline metadata details from a button named with its summary', async () => {
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

  const button = Array.from(container.querySelectorAll('button')).find((element) =>
    element.textContent.includes('Search: "biology reserves"')
  );
  expect(button).toBeTruthy();
  expect(button.getAttribute('role') || 'button').toBe('button');

  await act(async () => button.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  expect(document.body.textContent).toContain('Event Details - search');
});
