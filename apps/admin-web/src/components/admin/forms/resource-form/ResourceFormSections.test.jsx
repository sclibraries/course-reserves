import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { toHaveNoViolations } from 'vitest-axe/matchers';
import { fireEvent, getByRole, getByText, queryByRole } from '@testing-library/dom';
import TypeFieldsSection from './TypeFieldsSection';
import WhereSection from './WhereSection';

expect.extend({ toHaveNoViolations });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const axeOptions = { rules: { 'color-contrast': { enabled: false } } };

let container;
let root;

async function render(element) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root.render(element));
}

afterEach(() => {
  if (root) act(() => root.unmount());
  container?.remove();
  root = null;
  container = null;
});

describe('resource form sections', () => {
  it('renders type-defined fields by label and is axe clean', async () => {
    await render(
      <TypeFieldsSection
        materialTypeFields={[{
          field_name: 'publisher',
          field_type: 'text',
          label: 'Publisher',
          category: 'Publication',
        }]}
        metadata={{ publisher: 'Synthetic Press' }}
        handleFieldChange={vi.fn()}
      />,
    );

    const section = getByRole(container, 'region', { name: 'Type-specific fields' });
    expect(getByRole(section, 'textbox', { name: 'Publisher' }).value).toBe('Synthetic Press');
    expect(await axe(section, axeOptions)).toHaveNoViolations();
  });

  it('removes only the named additional link and keeps each proxy control accessible', async () => {
    function Harness() {
      const [links, setLinks] = useState([
        { url: 'https://example.test/one', title: 'First link', description: '', use_proxy: false },
        { url: 'https://example.test/two', title: 'Second link', description: '', use_proxy: true },
        { url: 'https://example.test/three', title: 'Third link', description: '', use_proxy: false },
      ]);

      return (
        <WhereSection
          formData={{ link: 'https://example.test/primary', use_proxy: false }}
          handleFieldChange={vi.fn()}
          links={links}
          setLinks={setLinks}
          source="EBSCO Discovery"
        />
      );
    }

    await render(<Harness />);
    const section = getByRole(container, 'region', { name: 'Where do students go?' });
    expect(getByRole(section, 'textbox', { name: 'Primary URL' }).value).toBe('https://example.test/primary');
    expect(getByText(section, 'Source: EBSCO Discovery')).toBeTruthy();
    expect(getByRole(section, 'checkbox', { name: 'Use proxy for this resource' })).toBeTruthy();
    for (const number of [1, 2, 3]) {
      expect(getByRole(section, 'checkbox', { name: `Use proxy for link ${number}` })).toBeTruthy();
    }
    expect(await axe(section, axeOptions)).toHaveNoViolations();

    await act(async () => fireEvent.click(getByRole(section, 'button', { name: 'Remove link 2: Second link' })));

    expect(getByRole(section, 'textbox', { name: 'URL for link 1' }).value).toBe('https://example.test/one');
    expect(getByRole(section, 'textbox', { name: 'URL for link 2' }).value).toBe('https://example.test/three');
    expect(queryByRole(section, 'button', { name: 'Remove link 2: Second link' })).toBeNull();
    expect(getByRole(section, 'button', { name: 'Remove link 2: Third link' })).toBeTruthy();
  });
});
