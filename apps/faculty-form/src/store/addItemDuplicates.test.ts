import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useReserveStore, type CourseReserve } from './useReserveStore';

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
  id: 'reserve-1',
  courseCode: 'ENG 101',
  courseTitle: 'Intro',
  section: '01',
  instructors: 'Prof',
  term: 'Fall 2026',
  status: 'draft',
  lastUpdated: '2026-06-24',
  folders: [],
  layout: [{ kind: 'item', id: 'item-1' }],
  items: [
    {
      id: 'item-1',
      title: 'Climate Change and Society',
      materialType: 'book',
      status: 'draft',
      barcode: '39099012345678',
    },
  ],
} satisfies CourseReserve;

describe('useReserveStore.addItem duplicate handling', () => {
  beforeEach(() => {
    useReserveStore.setState({ reserves: [{ ...reserve, items: [...reserve.items] }] });
  });

  it('blocks obvious duplicate items before adding them to a reserve', () => {
    useReserveStore.getState().addItem('reserve-1', {
      title: 'Climate Change and Society',
      materialType: 'book',
      status: 'draft',
      barcode: ' 39099012345678 ',
    });

    expect(useReserveStore.getState().getReserveById('reserve-1')?.items).toHaveLength(1);
  });

  it('returns the inserted item and null when an item is rejected as a duplicate', () => {
    const duplicate = useReserveStore.getState().addItem('reserve-1', {
      title: 'Climate Change and Society', materialType: 'book', status: 'draft', barcode: '39099012345678',
    });
    const added = useReserveStore.getState().addItem('reserve-1', {
      title: 'A unique synthetic title', materialType: 'book', status: 'draft',
    });

    expect(duplicate).toBe(false);
    expect(added).toMatchObject({ id: expect.any(String), title: 'A unique synthetic title' });
    expect(useReserveStore.getState().getReserveById('reserve-1')?.items).toContainEqual(added);
  });

  it('preserves source metadata when adding a unique physical reserve item', () => {
    useReserveStore.getState().addItem('reserve-1', {
      title: 'New Book',
      materialType: 'book',
      status: 'draft',
      barcode: '39099087654321',
      callNumber: 'QA 76 .N49',
      instanceId: 'instance-1',
      holdingsId: 'holdings-1',
      instanceHrid: 'hrid-1',
      copiedItem: {
        title: 'New Book',
        instanceId: 'instance-1',
        holdingsId: 'holdings-1',
      },
    });

    // Added materials now append to the end; locate the new item instead of depending on prepend order.
    const addedItem = useReserveStore.getState().getReserveById('reserve-1')?.items.find((item) => item.title === 'New Book');
    expect(addedItem).toMatchObject({
      barcode: '39099087654321',
      callNumber: 'QA 76 .N49',
      instanceId: 'instance-1',
      holdingsId: 'holdings-1',
      instanceHrid: 'hrid-1',
      copiedItem: expect.objectContaining({
        instanceId: 'instance-1',
        holdingsId: 'holdings-1',
      }),
    });
  });

  it('appends new items after existing items in the order they are added', () => {
    useReserveStore.getState().addItem('reserve-1', {
      title: 'First new item', materialType: 'book', status: 'draft',
    });
    useReserveStore.getState().addItem('reserve-1', {
      title: 'Second new item', materialType: 'book', status: 'draft',
    });

    expect(useReserveStore.getState().getReserveById('reserve-1')?.items.map((item) => item.title))
      .toEqual(['Climate Change and Society', 'First new item', 'Second new item']);
  });

  it('preserves a selected folder while appending an item', () => {
    useReserveStore.setState({
      reserves: [{
        ...reserve,
        folders: [{ id: 'folder-1', title: 'Week 1', isOpen: true, itemIds: [] }],
        layout: [{ kind: 'folder', id: 'folder-1' }, { kind: 'item', id: 'item-1' }],
      }],
    });

    useReserveStore.getState().addItem('reserve-1', {
      title: 'Folder item', materialType: 'article', status: 'draft', folderId: 'folder-1',
    });

    const items = useReserveStore.getState().getReserveById('reserve-1')?.items;
    expect(items?.map((item) => ({ title: item.title, folderId: item.folderId }))).toEqual([
      { title: 'Climate Change and Society', folderId: undefined },
      { title: 'Folder item', folderId: 'folder-1' },
    ]);
  });
});
