import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { screen } from '@testing-library/dom';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SubmissionDetail from './SubmissionDetail';
import { notify } from '@/services/notify';

const api = vi.hoisted(() => ({
  getMessages: vi.fn(),
  createMessage: vi.fn(),
  deleteSubmission: vi.fn(),
}));

vi.mock('@/services/api/communications', () => ({
  CommunicationsAPI: class {
    getMessages = api.getMessages;
    createMessage = api.createMessage;
  },
}));
vi.mock('@/store/courseReservesStore', () => ({
  useCourseReservesStore: () => ({
    getReserveById: () => ({
      id: 'submission-1', courseCode: 'BIO 101', courseTitle: 'Synthetic Biology', term: 'Fall 2026',
      status: 'submitted', canEdit: true, items: [{ id: 'item-1', title: 'Synthetic reading' }], folders: [],
    }),
    getReserveStats: () => ({ totalItems: 1, completeItems: 0 }),
    fetchSubmissionDetails: vi.fn(),
    deleteSubmission: api.deleteSubmission,
  }),
}));
vi.mock('@/components/pageHeaders/SubmissionDetailHeader', () => ({
  SubmissionDetailHeader: ({ onDelete }: { onDelete: () => void }) => <button onClick={onDelete}>Open delete</button>,
}));
vi.mock('@/components/SubmissionDetailItemsTable', () => ({
  SubmissionDetailItemsTable: ({ onItemMessage }: { onItemMessage: (message: never) => Promise<void> }) => (
    <button onClick={() => void onItemMessage({ subject: 'Synthetic question', message: 'Please clarify this item' } as never).catch(() => undefined)}>
      Send item message
    </button>
  ),
}));
vi.mock('@/components/Communications/CommunicationsContainer', () => ({ default: () => null }));
vi.mock('@/services/notify', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/notify')>();
  return { ...actual, notify: { success: vi.fn(), error: vi.fn(), info: vi.fn() } };
});

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('SubmissionDetail feedback', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    api.getMessages.mockResolvedValue([]);
    api.createMessage.mockResolvedValue({ success: true });
    api.deleteSubmission.mockResolvedValue(undefined);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root?.render(<MemoryRouter initialEntries={['/submission/submission-1']}>
      <Routes>
        <Route path="/submission/:id" element={<SubmissionDetail />} />
        <Route path="/" element={null} />
      </Routes>
    </MemoryRouter>));
  });

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    container = null;
    root = null;
    document.body.innerHTML = '';
  });

  it('announces a sent item message and a deleted submission', async () => {
    await act(async () => { screen.getByRole('button', { name: 'Send item message' }).click(); });
    expect(notify.success).toHaveBeenCalledWith('Message sent to library staff');

    await act(async () => { screen.getByRole('button', { name: 'Open delete' }).click(); });
    await act(async () => { screen.getByRole('button', { name: 'Delete Submission' }).click(); });
    expect(notify.success).toHaveBeenCalledWith('Submission deleted');
  });

  it('shows generic errors with the server reference for message and delete failures', async () => {
    api.createMessage.mockRejectedValueOnce({
      response: { data: { message: 'database password leaked', reference_id: '7F3K2Q' } },
    });
    await act(async () => { screen.getByRole('button', { name: 'Send item message' }).click(); });
    expect(notify.error).toHaveBeenCalledWith("Couldn't send the message", { reference: '7F3K2Q' });

    api.deleteSubmission.mockRejectedValueOnce({
      response: { data: { message: 'internal host leaked', reference: 'A1B2C3' } },
    });
    await act(async () => { screen.getByRole('button', { name: 'Open delete' }).click(); });
    await act(async () => { screen.getByRole('button', { name: 'Delete Submission' }).click(); });
    expect(notify.error).toHaveBeenCalledWith("Couldn't delete the submission", { reference: 'A1B2C3' });
    expect(document.body.textContent).not.toContain('database password leaked');
    expect(document.body.textContent).not.toContain('internal host leaked');
  });
});
