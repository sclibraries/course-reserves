import { describe, expect, it } from 'vitest';
import { getEdsMaterialType } from './edsMaterialType';

describe('getEdsMaterialType', () => {
  it.each([
    ['ebook', 'Ebook', 'ebook'],
    ['hyphenated ebook', 'E-Book', 'ebook'],
    ['periodical', 'Periodical', 'article'],
    ['magazine', 'Magazine', 'article'],
    ['academic', 'Academic Journal', 'article'],
    ['film', 'Film', 'media'],
    ['dvd', 'DVD', 'media'],
    ['streaming', 'Streaming Video', 'media'],
    ['monograph', 'Monograph', 'book'],
    ['chapter', 'Book Section', 'book'],
    ['video', 'Video', 'media'],
    ['other media', 'Other Media', 'media'],
    ['other', 'Other', 'website'],
  ])('maps %s publication types to %s', (_, publicationType, expected) => {
    expect(getEdsMaterialType({
      id: 'SYNTH-AN',
      dbId: 'SYNTH-DB',
      title: 'Synthetic record',
      authors: [],
      publicationType,
      pLink: 'https://example.test/record',
    })).toBe(expected);
  });
});
