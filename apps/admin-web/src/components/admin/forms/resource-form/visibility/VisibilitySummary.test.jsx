import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';
import { toHaveNoViolations } from 'vitest-axe/matchers';
import { getByRole } from '@testing-library/dom';
import { VisibilitySummary } from './VisibilitySummary';

expect.extend({ toHaveNoViolations });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const axeOptions = { rules: { 'color-contrast': { enabled: false } } };

let container;
let root;

afterEach(() => {
  if (root) act(() => root.unmount());
  container?.remove();
  root = null;
  container = null;
});

describe('visibility summary', () => {
  it('renders the summary accessibly', async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root.render(
      <VisibilitySummary summary={{
        citation: 'Available from 8/23/2026',
        primaryLink: 'Visible to students now',
        links: [{ title: 'Shared link', message: 'Visible to students now' }],
        sharedDatesMessage: "Cross-linked pages use this resource's shared dates",
      }} />,
    ));

    expect(getByRole(container, 'region', { name: 'Visibility summary' }).textContent)
      .toContain('Cross-linked pages use this resource\'s shared dates');
    expect(await axe(container, axeOptions)).toHaveNoViolations();
  });
});
