import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { toHaveNoViolations } from 'vitest-axe/matchers';
import { fireEvent, getAllByText, getByRole, getByText } from '@testing-library/dom';
import { ResourceTypeSelector } from '../common/ResourceTypeSelector';
import { TypeSpecificFields } from '../fields/TypeSpecificFields';
import { FieldMarker } from './FieldMarker';
import { OtherDetails } from './OtherDetails';
import { SourceStrip } from './SourceStrip';

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

describe('resource provenance UI', () => {
  it('shows the source strip and accessible EDS field marker with no axe violations', async () => {
    const onChangeRecord = vi.fn();
    await render(
      <>
        <SourceStrip
          source={{ summary: 'From EDS', text: 'From EDS: Synthetic title · Synthetic database · AN SYNTH-AN-17' }}
          canChangeRecord
          onChangeRecord={onChangeRecord}
          keptFields={['title']}
        />
        <OtherDetails
          metadata={{ doi: '10.5555/synthetic.17', publisher: 'Synthetic Press' }}
          materialTypeFields={[{ field_name: 'publisher' }]}
          markerFor={(field) => (field === 'doi' ? 'from EDS' : null)}
        />
        <FieldMarker marker="guessed" />
        <ResourceTypeSelector
          materialTypes={[{ material_type_id: '9', name: 'ebook', marker: 'guessed' }]}
          selectedTypeId="9"
          onTypeChange={() => {}}
        />
        <section aria-label="Type-specific fields">
          <TypeSpecificFields
            materialTypeFields={[{ field_name: 'publisher', field_type: 'text', label: 'Publisher', marker: 'from EDS' }]}
            metadata={{ publisher: 'Synthetic Press' }}
            handleFieldChange={() => {}}
          />
        </section>
      </>,
    );

    const source = getByRole(container, 'region', { name: 'Resource source' });
    const details = getByRole(container, 'region', { name: 'Other details' });
    expect(getAllByText(source, 'From EDS: Synthetic title · Synthetic database · AN SYNTH-AN-17', { selector: 'p' })).toHaveLength(2);
    fireEvent.click(getByRole(source, 'button', { name: 'Change record' }));
    expect(onChangeRecord).toHaveBeenCalledOnce();
    expect(getByRole(source, 'status').textContent).toBe('Kept your edits: Title');
    expect(getByText(details, '10.5555/synthetic.17')).toBeTruthy();
    expect(getByText(details, 'from EDS')).toBeTruthy();
    expect(getAllByText(container, 'guessed')).toHaveLength(2);
    expect(getByRole(container, 'combobox', { name: /Material Type.*guessed/ })).toBeTruthy();
    expect(getByRole(container, 'textbox', { name: /Publisher.*from EDS/ })).toBeTruthy();
    expect(await axe(source, axeOptions)).toHaveNoViolations();
    expect(await axe(details, axeOptions)).toHaveNoViolations();
    expect(await axe(getByRole(container, 'region', { name: 'Type-specific fields' }), axeOptions)).toHaveNoViolations();
    expect(await axe(container, axeOptions)).toHaveNoViolations();
  });
});
