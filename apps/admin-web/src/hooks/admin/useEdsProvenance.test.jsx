import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { renderHook } from './testUtils/renderHook';
import { useEdsProvenance } from './useEdsProvenance';

const materialTypes = [
  { material_type_id: '1', name: 'book' },
  { material_type_id: '2', name: 'article' },
  { material_type_id: '3', name: 'media' },
];

const initialData = {
  title: 'Synthetic EDS title',
  link: 'https://example.test/record/17',
  material_type_id: '1',
  metadata: {
    book_title: 'Synthetic EDS title',
    author_editor: 'Synthetic EDS author',
    publisher: 'Synthetic EDS press',
    database: 'Synthetic database',
    is_ebook: false,
    journal_title: 'Synthetic journal',
    doi: '10.5555/synthetic.17',
    accession_number: 'SYNTH-AN-17',
  },
};

let hook;

afterEach(() => {
  hook?.unmount();
  hook = null;
});

async function renderProvenance(data = initialData) {
  hook = await renderHook((props) => useEdsProvenance(props), {
    initialData: data,
    sourceType: 'eds',
    materialTypes,
  });
  return hook.current;
}

describe('useEdsProvenance', () => {
  it('keeps empty and false EDS baselines and removes markers when values change', async () => {
    const state = await renderProvenance();

    expect(state.baseline.metadata.isbn).toBe('');
    expect(state.baseline.metadata.is_ebook).toBe(false);
    expect(state.markerFor('is_ebook', false, '1')).toBe('from EDS');
    expect(state.markerFor('is_ebook', true, '1')).toBeNull();
    expect(state.markerFor('material_type_id', '1')).toBe('guessed');
    expect(state.markerFor('link', initialData.link)).toBe('guessed');
    expect(state.markerFor('link', 'https://example.test/edited')).toBeNull();
    expect(state.source.text).toBe('From EDS: Synthetic EDS title · Synthetic database · AN SYNTH-AN-17');
  });

  it('re-maps unchanged values for a manual type choice and keeps edited values for Other details', async () => {
    const state = await renderProvenance();
    const changed = state.remapMetadata('2', {
      ...initialData.metadata,
      publisher: 'Manually edited press',
    });

    expect(changed).toMatchObject({
      article_title: 'Synthetic EDS title',
      author: 'Synthetic EDS author',
      journal_title: 'Synthetic journal',
      doi: '10.5555/synthetic.17',
      publisher: 'Manually edited press',
      is_ebook: false,
    });
    expect(changed.book_title).toBeUndefined();
    expect(state.markerFor('article_title', changed.article_title, '2')).toBe('from EDS');

    const media = state.remapMetadata('3', initialData.metadata, '1');
    expect(media.library_database).toBe('Synthetic database');
  });

  it('re-maps the baseline again when the manually chosen type changes back', async () => {
    const state = await renderProvenance();
    const article = state.remapMetadata('2', initialData.metadata, '1');
    const book = state.remapMetadata('1', article, '2');

    expect(book.book_title).toBe('Synthetic EDS title');
    expect(book.author_editor).toBe('Synthetic EDS author');
    expect(book.article_title).toBeUndefined();
  });

  it('keeps edits, clears saved metadata missing from the new record, and omits unsaved metadata', async () => {
    hook = await renderHook((props) => useEdsProvenance(props), {
      initialData: {
        resource_id: 'resource-17',
        title: 'Loaded title',
        link: 'https://example.test/loaded',
        material_type_id: '1',
        metadata: {
          database: 'Synthetic old database',
          accession_number: 'SYNTH-OLD-17',
        },
      },
      sourceType: 'edit',
      materialTypes,
    });

    const currentData = {
      title: 'Staff-edited title',
      link: 'https://example.test/loaded',
      notes: '',
      material_type_id: '1',
      metadata: {
        database: 'Synthetic old database',
        accession_number: 'SYNTH-OLD-17',
      },
    };
    const nextRecord = {
      title: 'New EDS title',
      link: 'https://example.test/new',
      material_type_id: '2',
      notes: 'New EDS abstract',
      metadata: { accession_number: 'SYNTH-NEW-17' },
    };

    expect(hook.current.replaceRecord).toBeTypeOf('function');
    let result;
    act(() => {
      result = hook.current.replaceRecord(currentData, nextRecord, ['database', 'accession_number']);
    });

    expect(result.data).toMatchObject({
      title: 'Staff-edited title',
      link: 'https://example.test/new',
      notes: 'New EDS abstract',
      material_type_id: '2',
      metadata: {
        database: null,
        accession_number: 'SYNTH-NEW-17',
      },
    });
    expect(result.data.metadata).not.toHaveProperty('doi');
    expect(result.keptFields).toEqual(['title']);
  });

  it('omits an empty mapped field when an unsaved EDS pick is changed', async () => {
    hook = await renderHook((props) => useEdsProvenance(props), {
      initialData: {
        title: 'Synthetic EDS title',
        link: 'https://example.test/record/17',
        material_type_id: '1',
        metadata: { book_title: 'Synthetic EDS title' },
      },
      sourceType: 'eds',
      materialTypes,
    });

    let result;
    act(() => {
      result = hook.current.replaceRecord({
        title: 'Synthetic EDS title',
        link: 'https://example.test/record/17',
        material_type_id: '1',
        metadata: { book_title: 'Synthetic EDS title' },
      }, {
        title: 'Replacement EDS title',
        link: 'https://example.test/record/18',
        material_type_id: '1',
        metadata: { book_title: 'Replacement EDS title' },
      });
    });

    expect(result.data.metadata.isbn).toBeUndefined();
  });

  it('keeps a manual type and maps the replacement record to that type', async () => {
    const state = await renderProvenance();
    const metadata = state.remapMetadata('2', initialData.metadata, '1');
    const currentData = {
      title: initialData.title,
      link: initialData.link,
      notes: '',
      material_type_id: '2',
      metadata,
    };

    let result;
    act(() => {
      result = hook.current.replaceRecord(currentData, {
        title: 'Synthetic replacement title',
        link: 'https://example.test/replacement',
        material_type_id: '1',
        metadata: {
          book_title: 'Synthetic replacement title',
          author_editor: 'Synthetic replacement author',
          publisher: 'Synthetic replacement press',
          accession_number: 'SYNTH-AN-18',
        },
      });
    });

    expect(result.data.material_type_id).toBe('2');
    expect(result.data.metadata.article_title).toBe('Synthetic replacement title');
    expect(result.data.metadata.author).toBe('Synthetic replacement author');
    expect(result.data.metadata.book_title).toBeUndefined();
    expect(result.data.metadata.author_editor).toBeUndefined();
  });

  it.each([
    ['new', {}, undefined, 'Manual'],
    ['hitchcock', {}, undefined, 'Hitchcock'],
    ['reuse', { metadata: { accession_number: 'SYNTH-AN-17' } }, { course_count: 3 }, 'Reusing "Used in 3 courses"'],
    ['edit', { metadata: { accession_number: 'SYNTH-AN-17' } }, undefined, 'Created from EDS · AN SYNTH-AN-17'],
  ])('labels %s resources with their source', async (sourceType, data, usage, expected) => {
    hook = await renderHook((props) => useEdsProvenance(props), {
      initialData: data,
      sourceType,
      materialTypes,
      usage,
    });

    expect(hook.current.source.text).toBe(expected);
  });

  it.each([['loading', undefined], ['failed', null]])('uses a plain reuse label when usage is %s', async (_state, usage) => {
    hook = await renderHook((props) => useEdsProvenance(props), {
      initialData: {},
      sourceType: 'reuse',
      materialTypes,
      usage,
    });

    expect(hook.current.source.text).toBe('Reusing resource');
  });
});
