import { beforeEach, describe, expect, it, vi } from 'vitest';

const sonner = vi.hoisted(() => ({
  success: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
}));

vi.mock('sonner', () => ({ toast: sonner }));

import { notify, toUserError } from './notify';

describe('notify', () => {
  beforeEach(() => vi.clearAllMocks());

  it.each(['success', 'info', 'warning'])('%s notifications close after five seconds', (kind) => {
    notify[kind]('Item saved');

    expect(sonner[kind]).toHaveBeenCalledWith('Item saved', { duration: 5000 });
  });

  it('keeps errors open and includes their reference id', () => {
    notify.error("Couldn't save the access path", { reference: 'SYNTH-42' });

    expect(sonner.error).toHaveBeenCalledWith("Couldn't save the access path. Reference: SYNTH-42", {
      closeButton: true,
      duration: Infinity,
    });
  });

  it('does not invent a reference for a client-side error', () => {
    notify.error('Please enter a reply message');

    expect(sonner.error).toHaveBeenCalledWith('Please enter a reply message', {
      closeButton: true,
      duration: Infinity,
    });
  });

  it('uses a generic message and carries an error reference', () => {
    const error = Object.assign(new Error('Synthetic provider detail'), { reference: 'SYNTH-43' });

    expect(toUserError(error, "Couldn't save the access path")).toEqual({
      message: "Couldn't save the access path",
      reference: 'SYNTH-43',
    });
  });

  it('reports caught errors without exposing provider details', () => {
    const error = Object.assign(new Error('Synthetic provider detail'), { reference: 'SYNTH-44' });

    notify.fromError(error, "Couldn't save the access path");

    expect(sonner.error).toHaveBeenCalledWith("Couldn't save the access path. Reference: SYNTH-44", {
      closeButton: true,
      duration: Infinity,
    });
    expect(sonner.error.mock.calls[0][0]).not.toContain('Synthetic provider detail');
  });

  it('marks a missing request reference as unavailable', () => {
    notify.fromError(new Error('Synthetic provider detail'), "Couldn't save the access path");

    expect(sonner.error).toHaveBeenCalledWith("Couldn't save the access path. Reference: unavailable", {
      closeButton: true,
      duration: Infinity,
    });
  });

  it('extracts a reference already included by a safe service error', () => {
    const error = new Error('Library search is temporarily unavailable. Reference: 7F3K2Q');

    expect(toUserError(error, "Couldn't search the library")).toEqual({
      message: "Couldn't search the library",
      reference: '7F3K2Q',
    });
  });
});
