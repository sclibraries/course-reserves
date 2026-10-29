import { createElement } from 'react';
import { toast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getSafeErrorFeedback, notify } from './notify';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

beforeEach(() => vi.clearAllMocks());

describe('notify', () => {
  it('passes success actions through without setting its own duration', () => {
    const action = createElement('button', { type: 'button' }, 'Undo');

    notify.success('Item added', { action });

    expect(toast.success).toHaveBeenCalledWith('Item added', { action });
  });

  it('passes informational actions through without setting its own duration', () => {
    const action = createElement('button', { type: 'button' }, 'View course');

    notify.info('The existing course list was kept', { action });

    expect(toast.info).toHaveBeenCalledWith('The existing course list was kept', { action });
  });

  it('keeps toast-only information dismiss-only when requested', () => {
    notify.info('The existing server list was kept', { duration: Infinity });

    expect(toast.info).toHaveBeenCalledWith('The existing server list was kept', { duration: Infinity });
  });

  it('keeps errors visible and includes the reference id', () => {
    notify.error("Couldn't save the access path", { reference: '7F3K2Q' });

    expect(toast.error).toHaveBeenCalledWith("Couldn't save the access path", {
      description: 'Reference: 7F3K2Q',
      duration: Infinity,
    });
  });

  it('keeps client-side errors visible without a reference description', () => {
    notify.error('Please enter a title');

    expect(toast.error).toHaveBeenCalledWith('Please enter a title', { duration: Infinity });
  });

  it('omits the unavailable placeholder from client-side error feedback', () => {
    notify.error('Please enter a title', { reference: 'unavailable' });

    expect(toast.error).toHaveBeenCalledWith('Please enter a title', { duration: Infinity });
  });

  it('hides server text while preserving its reference id', () => {
    const feedback = getSafeErrorFeedback(
      { response: { data: { message: 'SQL connection password leaked', reference: '7F3K2Q' } } },
      "Couldn't save the access path"
    );

    expect(feedback).toEqual({ message: "Couldn't save the access path", reference: '7F3K2Q' });
    expect(JSON.stringify(feedback)).not.toContain('SQL connection password leaked');
  });

  it('uses an unavailable marker when a failure has no server reference', () => {
    expect(getSafeErrorFeedback(new Error('raw backend detail'), 'Could not save the item')).toEqual({
      message: 'Could not save the item',
      reference: 'unavailable',
    });
  });
});
