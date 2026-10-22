import { describe, expect, it } from 'vitest';

import { parseCitation } from './citationParser';

describe('parseCitation', () => {
  it('parses APA-style journal citations with a DOI URL', () => {
    const parsed = parseCitation(
      'Test Author, A. (2015). A synthetic research title. Example Journal of Synthetic Studies, 13(1/2), 203–217. https://doi.org/10.1234/example.test.2015'
    );

    expect(parsed).toEqual({
      author: 'Test Author, A.',
      title: 'A synthetic research title',
      source: 'Example Journal of Synthetic Studies',
    });
  });

  it('parses multiline APA-style citations with multiple authors and a DOI URL', () => {
    const parsed = parseCitation(`Test Author A., Sample Author B., & Example Author C. (2021). Planning a synthetic study using example
          research methods. Example Computer Journal, 192, 3123–3133.
          https://doi.org/10.1234/example.2021.0001`);

    expect(parsed).toEqual({
      author: '',
      title:
        'Planning a synthetic study using example research methods',
      source: 'Example Computer Journal',
    });
  });

  it('keeps quoted-title citations working', () => {
    const parsed = parseCitation(
      'Test Author, "A Synthetic Citation Parsing Title," Example Journal 60, 2 (June 2014): 5-28'
    );

    expect(parsed).toEqual({
      author: 'Test Author',
      title: 'A Synthetic Citation Parsing Title',
      source: 'Example Journal',
    });
  });

  it('drops the author field for quoted citations with multiple authors', () => {
    const parsed = parseCitation(
      'Example Author and Sample Author, "A Synthetic Topic, with the "Example Phrase"," Example Journal 41 (2013): 154-171.'
    );

    expect(parsed).toEqual({
      author: '',
      title: 'A Synthetic Topic, with the "Example Phrase"',
      source: 'Example Journal',
    });
  });

  it('parses book chapters whose source titles contain numbers', () => {
    const parsed = parseCitation(
      'Test Author R. S., "Identity, Space and a Synthetic Union," in Example Editor One and Example Editor Two eds., A Synthetic Book on Modern Topics (Example City: Example University Press, 2000), 37-44'
    );

    expect(parsed).toEqual({
      author: 'Test Author R. S.',
      title: 'Identity, Space and a Synthetic Union',
      source: 'A Synthetic Book on Modern Topics',
    });
  });

  it('parses MLA-style quoted articles with volume and page markers', () => {
    const parsed = parseCitation(
      'Example, Author. “Choosing a Synthetic Topic for Research.” Example Framework, vol. 36, 1989, pp. 15-23.'
    );

    expect(parsed).toEqual({
      author: 'Example, Author.',
      title: 'Choosing a Synthetic Topic for Research',
      source: 'Example Framework',
    });
  });

  it('parses slash-style edited book citations without treating editors as authors', () => {
    const parsed = parseCitation(
      'Synthetic Research Topics / edited by Example Editor A., Sample Editor B., and Test Editor C. (1st ed. 2014.). Example Press New York'
    );

    expect(parsed).toEqual({
      author: '',
      title: 'Synthetic Research Topics',
      source: 'Example Press New York',
    });
  });

  it('parses author-year citations whose title is a slash-style edited book', () => {
    const parsed = parseCitation(
      'Example, A., Sample, B., Test, C., and Demo Catalog (online service). (2014). Synthetic Research Topics / edited by Example Editor A., Sample Editor B., and Test Editor C. (1st ed. 2014.). Example Press New York.'
    );

    expect(parsed).toEqual({
      author: '',
      title: 'Synthetic Research Topics',
      source: 'Example Press New York',
    });
  });
});
