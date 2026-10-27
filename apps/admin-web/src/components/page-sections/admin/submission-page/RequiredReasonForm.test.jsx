import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { fireEvent, screen } from '@testing-library/dom';
import PropTypes from 'prop-types';
import axe from 'axe-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import RequiredReasonForm from './RequiredReasonForm';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function Harness({ onConfirm, showReason, error }) {
  const [open, setOpen] = useState(true);

  return (
    <main>
      <RequiredReasonForm
        open={open}
        onCancel={() => setOpen(false)}
        onConfirm={onConfirm}
        saving={false}
        reasonId="shared-reason"
        reasonLabel="Reason (required)"
        helpText="This reason is recorded in the activity history."
        error={error}
        submitLabel="Confirm reason"
        showReason={showReason}
      />
      {!open && <button type="button" onClick={() => setOpen(true)}>Reopen reason form</button>}
    </main>
  );
}

Harness.propTypes = { onConfirm: PropTypes.func.isRequired, showReason: PropTypes.bool, error: PropTypes.string };

async function renderForm(onConfirm, showReason = true, error = '') {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => root.render(<Harness onConfirm={onConfirm} showReason={showReason} error={error} />));
  return () => {
    act(() => root.unmount());
    container.remove();
  };
}

afterEach(() => { document.body.innerHTML = ''; });

describe('RequiredReasonForm', () => {
  it('requires and trims a reason, resets when closed, and has no axe violations', async () => {
    const onConfirm = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const unmount = await renderForm(onConfirm);
    const reason = screen.getByRole('textbox', { name: 'Reason (required)' });

    expect(reason.required).toBe(true);
    expect(reason.getAttribute('aria-describedby')).toBe('shared-reason-help');
    expect(screen.getByRole('button', { name: 'Confirm reason' }).disabled).toBe(true);
    const initialAxe = await axe.run(document.body, { rules: { 'color-contrast': { enabled: false } } });
    expect(initialAxe.violations).toEqual([]);

    await act(async () => fireEvent.change(reason, { target: { value: '   ' } }));
    expect(screen.getByRole('button', { name: 'Confirm reason' }).disabled).toBe(true);
    await act(async () => fireEvent.change(reason, { target: { value: '  Approved reason  ' } }));
    const confirm = screen.getByRole('button', { name: 'Confirm reason' });
    expect(confirm.disabled).toBe(false);
    await act(async () => fireEvent.click(confirm));

    expect(onConfirm).toHaveBeenCalledOnce();
    expect(screen.getByRole('textbox', { name: 'Reason (required)' })).toBeTruthy();
    await act(async () => fireEvent.click(confirm));

    expect(onConfirm).toHaveBeenCalledWith('Approved reason');
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Reopen reason form' })));
    expect(screen.getByRole('textbox', { name: 'Reason (required)' }).value).toBe('');
    unmount();
  });

  it('can hide the reason field while its child controls are loading', async () => {
    const unmount = await renderForm(vi.fn(), false);

    expect(screen.queryByRole('textbox', { name: 'Reason (required)' })).toBeNull();
    unmount();
  });

  it('associates request errors with the reason field', async () => {
    const unmount = await renderForm(vi.fn(), true, 'The reason was not accepted.');
    const reason = screen.getByRole('textbox', { name: 'Reason (required)' });

    expect(reason.getAttribute('aria-describedby')).toBe('shared-reason-help shared-reason-error');
    expect(screen.getByRole('alert').id).toBe('shared-reason-error');
    unmount();
  });
});
