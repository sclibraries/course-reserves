import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { notify } from '@/services/notify';
import { useEditorUIStore } from '@/store/useEditorUIStore';
import type { CorrectionRequiredDetail } from '@/services/submissionUpdateErrors';
import CorrectionRequiredDialog from './CorrectionRequiredDialog';

const { createMessage } = vi.hoisted(() => ({ createMessage: vi.fn() }));
vi.mock('@/services/api/communications', () => ({
  CommunicationsAPI: class {
    createMessage = createMessage;
  },
}));
vi.mock('@/services/notify', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/notify')>();
  return { ...actual, notify: { success: vi.fn(), error: vi.fn(), info: vi.fn() } };
});

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const detail: CorrectionRequiredDetail = {
  submissionUuid: 'submission-uuid',
  itemIds: [259],
  attemptedUpdate: {
    items: [{ item_uuid: '259', title: 'Climate and Society', author: 'A. Researcher', material_type: 'book' }],
  },
};

describe('CorrectionRequiredDialog', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    useEditorUIStore.setState({ correctionRequiredDialogOpen: true, correctionRequiredDetail: detail });
  });

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    container = null;
    root = null;
    document.body.innerHTML = '';
  });

  const render = () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root!.render(<CorrectionRequiredDialog />));
  };

  const findButton = (label: string) =>
    Array.from(document.querySelectorAll('button')).find((button) => button.textContent?.includes(label));

  it('explains the staff-assisted process, summarizes the edit, and sends an item-linked message', async () => {
    createMessage.mockResolvedValue({ success: true, message_id: 1, message: 'Message sent' });
    render();

    expect(document.body.textContent).toContain('must be corrected by library staff');
    expect(document.body.textContent).toContain('Climate and Society');
    expect(document.body.textContent).toContain('author');

    await act(async () => {
      findButton('Send to library staff')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(createMessage).toHaveBeenCalledWith('submission-uuid', {
      subject: 'Requested correction to processed reserve item',
      category: 'issue',
      priority: 'normal',
      resource_id: 259,
      message: expect.stringContaining('Climate and Society'),
    });
    expect(notify.success).toHaveBeenCalledWith('Correction request sent to library staff.');
    expect(useEditorUIStore.getState().correctionRequiredDialogOpen).toBe(false);
  });

  it('keeps the summary open after a send error and permits retry', async () => {
    createMessage
      .mockRejectedValueOnce(new Error('Network unavailable'))
      .mockResolvedValueOnce({ success: false, message_id: 0, message: 'Not saved' })
      .mockResolvedValueOnce({ success: true, message_id: 1, message: 'Message sent' });
    render();

    await act(async () => {
      findButton('Send to library staff')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(document.body.textContent).toContain('Climate and Society');
    expect(document.body.textContent).toContain('could not be sent');
    expect(notify.error).toHaveBeenCalledWith('Could not send the correction request', { reference: undefined });
    expect(useEditorUIStore.getState().correctionRequiredDialogOpen).toBe(true);

    await act(async () => {
      findButton('Send to library staff')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(useEditorUIStore.getState().correctionRequiredDialogOpen).toBe(true);

    await act(async () => {
      findButton('Send to library staff')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(createMessage).toHaveBeenCalledTimes(3);
    expect(createMessage.mock.calls[2][1]).toMatchObject({
      resource_id: 259,
      message: expect.stringContaining('Climate and Society'),
    });
    expect(useEditorUIStore.getState().correctionRequiredDialogOpen).toBe(false);
  });
});
