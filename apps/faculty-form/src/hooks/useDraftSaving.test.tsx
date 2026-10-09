import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDraftSaving } from './useDraftSaving';
import type { CourseReserve } from '@/store/courseReservesStore';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.hoisted(() => {
  const store: Record<string, string> = {};
  // @ts-expect-error - vi is available in vitest's transform context
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => (key in store ? store[key] : null),
    setItem: (key: string, value: string) => {
      store[key] = String(value);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      for (const key of Object.keys(store)) delete store[key];
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
    get length() {
      return Object.keys(store).length;
    },
  });
});

const reserve = {
  id: 'sub-1',
  courseCode: 'ENG 101',
  courseTitle: 'Intro',
  section: '01',
  instructors: 'Prof',
  term: 'Fall 2026',
  status: 'submitted',
  items: [],
  folders: [],
  lastUpdated: '2026-06-24',
} as unknown as CourseReserve;

type DraftSavingApi = ReturnType<typeof useDraftSaving>;

function Harness({
  autoSaveEnabled,
  onSave,
  onReady,
}: {
  autoSaveEnabled: boolean;
  onSave: NonNullable<Parameters<typeof useDraftSaving>[2]['onSave']>;
  onReady: (api: DraftSavingApi) => void;
}) {
  const api = useDraftSaving('sub-1', reserve, {
    autoSaveDelay: 1000,
    autoSaveEnabled,
    onSave,
  });

  React.useEffect(() => {
    onReady(api);
  }, [api, onReady]);

  return null;
}

describe('useDraftSaving', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;
  let api: DraftSavingApi | null = null;

  beforeEach(() => {
    vi.useFakeTimers();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    api = null;
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    container?.remove();
    container = null;
    root = null;
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('cancels a queued autosave when autosave becomes disabled', () => {
    const onSave = vi.fn(async () => true);
    const onReady = (nextApi: DraftSavingApi) => {
      api = nextApi;
    };

    act(() => {
      root?.render(<Harness autoSaveEnabled={true} onSave={onSave} onReady={onReady} />);
    });
    act(() => {
      api?.markChanged();
    });
    act(() => {
      root?.render(<Harness autoSaveEnabled={false} onSave={onSave} onReady={onReady} />);
    });
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(onSave).not.toHaveBeenCalled();
  });
});
