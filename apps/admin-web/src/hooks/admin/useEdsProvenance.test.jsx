import { afterEach, describe, expect, it } from 'vitest';
import { renderHook } from './testUtils/renderHook';
import { useEdsProvenance } from './useEdsProvenance';

const materialTypes = [
  { material_type_id: '1', name: 'book' },
  { material_type_id: '2', name: 'article' },
];

const initialData = {
  title: 'Synthetic EDS title',
  link: 'https://example.test/record/17',
  material_type: '1',
  metadata: {
    book_title: 'Synthetic EDS title',
    author_editor: 'Synthetic EDS author',
    publisher: 'Synthetic EDS press',
    is_ebook: false,
    journal_title: 'Synthetic journal',
    doi: '10.5555/synthetic.17',
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
    sourceRecord: {
      title: 'Synthetic EDS title',
      metadata: { database: 'Synthetic database', accession_number: 'SYNTH-AN-17' },
    },
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
  });

  it('re-maps the baseline again when the manually chosen type changes back', async () => {
    const state = await renderProvenance();
    const article = state.remapMetadata('2', initialData.metadata, '1');
    const book = state.remapMetadata('1', article, '2');

    expect(book.book_title).toBe('Synthetic EDS title');
    expect(book.author_editor).toBe('Synthetic EDS author');
    expect(book.article_title).toBeUndefined();
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
});
