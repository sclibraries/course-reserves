import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it } from 'vitest';
import './App';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;

afterEach(() => {
  if (root) {
    act(() => root.unmount());
    root = null;
  }
  if (container) {
    container.remove();
    container = null;
  }
});

it('renders a registered string-named icon as an SVG', async () => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);

  await act(async () => {
    root.render(<FontAwesomeIcon icon="fa-solid fa-plus" />);
  });

  expect(container.querySelector('svg[data-icon="plus"] path')).not.toBeNull();
});
