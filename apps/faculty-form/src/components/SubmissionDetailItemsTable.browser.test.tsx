import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { fireEvent, getByRole, within } from '@testing-library/dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations, expectNoHorizontalOverflow } from '@/test/browser';
import type { CreateMessageRequest } from '@/services/api/communications';
import type { CourseReserve } from '@/store/reserve/types';
import { SubmissionDetailItemsTable } from './SubmissionDetailItemsTable';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const reserve: CourseReserve = {
  id: 'submission-message-test',
  submissionUuid: 'submission-message-test',
  courseCode: 'BIO 220',
  courseTitle: 'Synthetic Ecology',
  section: '01',
  instructors: 'Test Faculty',
  term: '2026FA',
  status: 'submitted',
  items: [
    {
      id: 'material-new-31', backendItemId: '31', backendKind: 'new', isReuse: true,
      title: 'New table reuse item', materialType: 'book', status: 'draft', displayOrder: 0,
    },
    {
      id: 'material-reuse-31', backendItemId: '31', backendKind: 'reuse', isReuse: true,
      title: 'Legacy reuse item', materialType: 'book', status: 'draft', displayOrder: 1,
    },
  ],
  folders: [],
  layout: [
    { kind: 'item', id: 'material-new-31' },
    { kind: 'item', id: 'material-reuse-31' },
  ],
  lastUpdated: 'Aug 1, 2026',
};

describe('SubmissionDetailItemsTable in Chromium', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    container = null;
    root = null;
  });

  it('sends legacy reuse messages at submission level and stays accessible without overflow', async () => {
    const onItemMessage = vi.fn(async (_request: CreateMessageRequest) => {});
    const getItemMessageCount = vi.fn(() => 2);
    const getItemUnreadCount = vi.fn(() => 1);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root?.render(
      <main>
        <h1>Submission details</h1>
        <SubmissionDetailItemsTable
          reserve={reserve}
          onItemMessage={onItemMessage}
          getItemMessageCount={getItemMessageCount}
          getItemUnreadCount={getItemUnreadCount}
          onAddMaterials={() => {}}
        />
      </main>,
    ));

    expect(getItemMessageCount.mock.calls).toEqual([[31]]);
    expect(getItemUnreadCount.mock.calls).toEqual([[31]]);

    const legacyRow = getByRole(document.body, 'row', { name: /Legacy reuse item/ });
    expect(within(legacyRow).queryByText('1 new')).toBeNull();

    const newItemOpener = getByRole(document.body, 'button', { name: 'Message about New table reuse item' });
    newItemOpener.focus();
    await act(async () => fireEvent.click(newItemOpener));
    const newItemDialog = getByRole(document.body, 'dialog');
    fireEvent.change(getByRole(newItemDialog, 'textbox', { name: 'Message *' }), {
      target: { value: 'Please check this synthetic new item.' },
    });
    await act(async () => fireEvent.click(getByRole(newItemDialog, 'button', { name: 'Send Message' })));
    expect(onItemMessage).toHaveBeenCalledTimes(1);
    expect(onItemMessage.mock.calls[0]?.[0].resource_id).toBe(31);
    await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeNull());

    const opener = getByRole(document.body, 'button', { name: 'Message about Legacy reuse item' });
    opener.focus();
    await act(async () => fireEvent.click(opener));
    const dialog = getByRole(document.body, 'dialog');
    expect(dialog.textContent).toContain('sent about the submission');
    expect(getByRole(dialog, 'textbox', { name: 'Subject' })).toHaveProperty(
      'value', 'Question about: Legacy reuse item',
    );
    await expectNoAxeViolations(dialog);
    await expectNoHorizontalOverflow([320, 768, 1280]);

    fireEvent.change(getByRole(dialog, 'textbox', { name: 'Message *' }), {
      target: { value: 'Please check this synthetic item.' },
    });
    await act(async () => fireEvent.click(getByRole(dialog, 'button', { name: 'Send Message' })));
    expect(onItemMessage).toHaveBeenCalledTimes(2);
    expect(onItemMessage.mock.calls[1]?.[0].resource_id).toBeUndefined();
    expect(onItemMessage.mock.calls[1]?.[0].subject).toBe('Question about: Legacy reuse item');
  });
});
