import { fireEvent, getByRole, getByText } from '@testing-library/dom';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Message } from '@/services/api/communications';
import { expectNoAxeViolations } from '@/test/expectNoAxeViolations';
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

  it('uses a subject disclosure button and keeps the message body outside it', async () => {
    const onMarkAsRead = vi.fn();
    const message: Message = {
      id: 37,
      resource_id: 74,
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
      <main>
        <MessageCard
          message={message}
          onMarkAsRead={onMarkAsRead}
          onReply={async () => undefined}
          onResolve={() => undefined}
        />
      </main>,
    ));

    const heading = getByRole(container, 'heading', { name: /Course reserve question/ });
    const toggle = heading.querySelector('button');
    expect(toggle).not.toBeNull();
    if (!toggle) return;
    expect(toggle.textContent).toBe('Course reserve question');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    const body = getByText(container, message.message);
    const sender = getByText(container, 'Course staff');
    const relatedItem = getByText(container, '📎 Related to Item #74');
    expect(toggle.contains(body)).toBe(false);
    expect(toggle.contains(sender)).toBe(false);
    expect(toggle.contains(relatedItem)).toBe(false);
    expect(body.id).toBe(toggle.getAttribute('aria-controls'));
    act(() => fireEvent.click(toggle!));

    expect(onMarkAsRead).toHaveBeenCalledWith(message.id);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(getByRole(container, 'button', { name: 'Reply' })).toBeTruthy();
    await expectNoAxeViolations(container);
  });
});
