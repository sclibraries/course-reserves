import { fireEvent, getByRole } from '@testing-library/dom';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Message } from '@/services/api/communications';
import MessageCard from './MessageCard';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('MessageCard accessibility', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    container = null;
    root = null;
  });

  it('opens a message with a named keyboard-operable button', () => {
    const onMarkAsRead = vi.fn();
    const message: Message = {
      id: 37,
      resource_id: null,
      subject: 'Course reserve question',
      message: 'Can this item be added to the course reserves?',
      category: 'question',
      priority: 'normal',
      status: 'active',
      sender_name: 'Course staff',
      sender_type: 'staff',
      created_at: '2026-10-21T12:00:00Z',
      is_read: false,
      reply_count: 0,
      replies: [],
    };
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => root?.render(
      <MessageCard
        message={message}
        onMarkAsRead={onMarkAsRead}
        onReply={async () => undefined}
        onResolve={() => undefined}
      />,
    ));

    const toggle = getByRole(container, 'button', { name: 'Expand message: Course reserve question' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    act(() => fireEvent.click(toggle));

    expect(onMarkAsRead).toHaveBeenCalledWith(message.id);
    expect(getByRole(container, 'button', { name: 'Collapse message: Course reserve question' }).getAttribute('aria-expanded')).toBe('true');
    expect(getByRole(container, 'button', { name: 'Reply' })).toBeTruthy();
  });
});
