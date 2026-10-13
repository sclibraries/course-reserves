import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import CourseViewContext from '../../../contexts/CourseViewContext';
import ViewControls from './ViewControls';
import RegistrationConfirmation from '../../../pages/RegistrationConfirmation';

vi.mock('../../../services/trackingService', () => ({
  trackingService: { trackEvent: vi.fn() },
}));

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

async function render(element) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);

  await act(async () => {
    root.render(element);
  });

  return container;
}

it('renders the course view control icons as SVGs', async () => {
  const view = await render(
    <CourseViewContext.Provider value={{ courseInfo: {}, collegeParam: null }}>
      <ViewControls
        viewMode="combined"
        setViewMode={vi.fn()}
        filter="all"
        onFilterChange={vi.fn()}
        records={[]}
      />
    </CourseViewContext.Provider>,
  );
  const buttonWithText = text => [...view.querySelectorAll('button')]
    .find(button => button.textContent.includes(text));

  expect(buttonWithText('Combined View').querySelector('svg[data-icon="table-list"]')).not.toBeNull();
  expect(buttonWithText('Split View').querySelector('svg[data-icon="table-columns"]')).not.toBeNull();
  expect(buttonWithText('All Materials').querySelector('svg[data-icon="layer-group"]')).not.toBeNull();
  expect(buttonWithText('Physical Only').querySelector('svg[data-icon="book"]')).not.toBeNull();
  expect(buttonWithText('Electronic Only').querySelector('svg[data-icon="laptop"]')).not.toBeNull();
  expect(view.querySelector('i.fas')).toBeNull();
});

it('renders the registration confirmation icon as an SVG', async () => {
  const view = await render(
    <MemoryRouter>
      <RegistrationConfirmation />
    </MemoryRouter>,
  );

  const icon = view.querySelector('.mb-4 > svg[data-icon="circle-check"]');
  expect(icon).not.toBeNull();
  expect(icon.style.fontSize).toBe('4rem');
  expect(view.querySelector('i.fas')).toBeNull();
});
