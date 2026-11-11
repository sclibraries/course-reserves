import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import PropTypes from 'prop-types';
import { afterEach, describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';
import { toHaveNoViolations } from 'vitest-axe/matchers';
import { fireEvent, getByLabelText, getByRole, queryByRole, waitFor } from '@testing-library/dom';
import { Toaster } from '../../../../ui/sonner';
import { useVisibilityFormState } from '../../../../../hooks/admin/useVisibilityFormState';
import { VisibilitySection } from './VisibilitySection';

expect.extend({ toHaveNoViolations });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const axeOptions = { rules: { 'color-contrast': { enabled: false } } };
const defaultDates = { startDate: '2026-09-01', endDate: '2026-12-20' };
const defaultFormData = {
  link: 'https://example.test/primary',
  use_resource_visibility: 1,
  start_visibility: '2026-09-01',
  end_visibility: '',
  use_primary_link_visibility: true,
  primary_link_start_visibility: '2026-06-01',
  primary_link_end_visibility: '2026-08-01',
};
const defaultLinks = [
  {
    url: 'https://example.test/custom',
    title: 'Synthetic custom link',
    use_link_visibility: false,
    start_visibility: '2026-10-01',
    end_visibility: '2027-01-01',
  },
  {
    url: 'https://example.test/ordinary',
    title: 'Synthetic ordinary link',
    use_link_visibility: false,
    start_visibility: '2026-09-01',
    end_visibility: '',
  },
];
const summary = {
  citation: 'Visible to students now',
  primaryLink: 'Visible to students now',
  links: [],
  sharedDatesMessage: "Cross-linked pages use this resource's shared dates",
};

function VisibilityHarness({
  sourceType = 'edit',
  initialFormData = defaultFormData,
  initialLinks = defaultLinks,
}) {
  const [formData, setFormData] = useState(initialFormData);
  const [links, setLinks] = useState(initialLinks);
  const visibility = useVisibilityFormState({
    defaultDates,
    initialData: { resource_id: 'synthetic-resource' },
    sourceType,
    formData,
    setFormData,
    links,
    setLinks,
  });

  return (
    <>
      <Toaster />
      <VisibilitySection
        formData={formData}
        mode="course"
        sourceType={sourceType}
        useVisibilityDates={visibility.useVisibilityDates}
        hasItemDates={visibility.hasItemDates}
        onResourceVisibilityToggle={visibility.handleResourceVisibilityToggle}
        onItemDateChange={visibility.handleItemDateChange}
        onPrimaryLinkVisibilityToggle={visibility.handlePrimaryLinkVisibilityToggle}
        onPrimaryLinkDateChange={visibility.handlePrimaryLinkDateChange}
        summary={summary}
        links={links}
        onLinkVisibilityChange={visibility.handleLinkVisibilityChange}
        onLinkDateChange={visibility.handleLinkDateChange}
        customWindowCount={visibility.customWindowCount}
        onApplyItemDates={visibility.handleApplyItemDates}
      />
    </>
  );
}

VisibilityHarness.propTypes = {
  sourceType: PropTypes.string,
  initialFormData: PropTypes.object,
  initialLinks: PropTypes.arrayOf(PropTypes.object),
};

let container;
let root;

async function renderVisibilityForm(props) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root.render(<VisibilityHarness {...props} />));
  return getByRole(container, 'region', { name: 'When can students see it?' });
}

afterEach(() => {
  if (root) act(() => root.unmount());
  container?.remove();
  root = null;
  container = null;
});

describe('apply item dates to additional links', () => {
  it('confirms custom windows, leaves links unchanged on Cancel or Escape, then applies dates and announces success', async () => {
    const section = await renderVisibilityForm();
    const applyButton = getByRole(section, 'button', { name: 'Apply item dates to additional links' });
    const linkOne = getByRole(section, 'checkbox', { name: 'Link 1 only between' });
    const linkTwo = getByRole(section, 'checkbox', { name: 'Link 2 only between' });
    const primaryStart = getByLabelText(section, 'Primary link start date');
    const primaryEnd = getByLabelText(section, 'Primary link end date');
    applyButton.focus();
    await act(async () => fireEvent.click(applyButton));

    let confirmation = getByRole(document.body, 'dialog', { name: 'Apply item dates to additional links?' });
    expect(confirmation.textContent).toContain('1 custom date window');
    expect(await axe(document.body, axeOptions)).toHaveNoViolations();
    await act(async () => fireEvent.click(getByRole(confirmation, 'button', { name: 'Cancel' })));
    await waitFor(() => expect(document.activeElement).toBe(applyButton));
    expect(queryByRole(document.body, 'dialog', { name: 'Apply item dates to additional links?' })).toBeNull();
    expect(linkOne.checked).toBe(false);
    expect(linkTwo.checked).toBe(false);

    await act(async () => fireEvent.click(applyButton));
    confirmation = getByRole(document.body, 'dialog', { name: 'Apply item dates to additional links?' });
    await act(async () => fireEvent.keyDown(confirmation, { key: 'Escape', code: 'Escape' }));
    await waitFor(() => expect(document.activeElement).toBe(applyButton));
    expect(queryByRole(document.body, 'dialog', { name: 'Apply item dates to additional links?' })).toBeNull();
    expect(linkOne.checked).toBe(false);
    expect(linkTwo.checked).toBe(false);

    await act(async () => fireEvent.click(applyButton));
    confirmation = getByRole(document.body, 'dialog', { name: 'Apply item dates to additional links?' });
    await act(async () => fireEvent.click(getByRole(confirmation, 'button', { name: 'Apply dates' })));
    await waitFor(() => expect(document.activeElement).toBe(applyButton));

    expect(linkOne.checked).toBe(true);
    expect(linkTwo.checked).toBe(true);
    expect(getByLabelText(section, 'Link 1 start date').value).toBe('2026-09-01');
    expect(getByLabelText(section, 'Link 1 end date').value).toBe('');
    expect(getByLabelText(section, 'Link 2 start date').value).toBe('2026-09-01');
    expect(getByLabelText(section, 'Link 2 end date').value).toBe('');
    expect(primaryStart.value).toBe('2026-06-01');
    expect(primaryEnd.value).toBe('2026-08-01');
    expect(getByRole(section, 'status').textContent).toBe('Item dates applied to 2 links');
    await waitFor(() => expect(document.querySelector('[data-sonner-toast][data-type="success"]')?.textContent)
      .toContain('Item dates applied to 2 links'));

    await act(async () => {
      fireEvent.click(linkOne);
      fireEvent.click(linkTwo);
    });
    await act(async () => fireEvent.click(applyButton));
    expect(queryByRole(document.body, 'dialog', { name: 'Apply item dates to additional links?' })).toBeNull();
    expect(linkOne.checked).toBe(true);
    expect(linkTwo.checked).toBe(true);
  });

  it('confirms a link with visibility enabled even when its dates match the item', async () => {
    const section = await renderVisibilityForm({
      initialLinks: [{
        ...defaultLinks[1],
        use_link_visibility: true,
      }],
    });
    const applyButton = getByRole(section, 'button', { name: 'Apply item dates to additional links' });
    applyButton.focus();
    await act(async () => fireEvent.click(applyButton));

    expect(getByRole(document.body, 'dialog', { name: 'Apply item dates to additional links?' }).textContent)
      .toContain('1 custom date window');
  });

  it.each([
    {
      name: 'empty item dates',
      sourceType: 'edit',
      initialFormData: { ...defaultFormData, start_visibility: '', end_visibility: '' },
      initialLinks: defaultLinks,
      reason: 'Set at least one item date before applying dates to additional links.',
    },
    {
      name: 'resource reuse',
      sourceType: 'reuse',
      initialFormData: defaultFormData,
      initialLinks: [],
      reason: 'Item dates cannot be applied while reusing a resource.',
    },
  ])('disables the action with a reason for $name', async ({ sourceType, initialFormData, initialLinks, reason }) => {
    const section = await renderVisibilityForm({ sourceType, initialFormData, initialLinks });
    const button = getByRole(section, 'button', { name: 'Apply item dates to additional links' });
    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-describedby')).toBeTruthy();
    expect(document.getElementById(button.getAttribute('aria-describedby')).textContent).toBe(reason);
  });
});
