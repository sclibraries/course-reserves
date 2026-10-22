import { describe, expect, it } from 'vitest';

import { extractCitationsFromSyllabus } from './syllabusCitationExtractor';

describe('extractCitationsFromSyllabus', () => {
  it('detects a single-line quoted-title citation with author-first formatting', () => {
    const { citations } = extractCitationsFromSyllabus(
      'Test Author, “A Synthetic Citation Parsing Title,” Example Journal 60, 2 (June 2014): 5-28'
    );

    expect(citations).toEqual([
      'Test Author, “A Synthetic Citation Parsing Title,” Example Journal 60, 2 (June 2014): 5-28',
    ]);
  });

  it('keeps a wrapped APA citation together when the title follows the year', () => {
    const { citations } = extractCitationsFromSyllabus(`Test Author A., Sample Author B., & Example Author C. (2021). Planning a synthetic study using example
          research methods. Example Computer Journal, 192, 3123–3133.
          https://doi.org/10.1234/example.2021.0001`);

    expect(citations).toEqual([
      'Test Author A., Sample Author B., & Example Author C. (2021). Planning a synthetic study using example research methods. Example Computer Journal, 192, 3123–3133. https://doi.org/10.1234/example.2021.0001',
    ]);
  });

  it('can still split consecutive citations when there are no blank lines', () => {
    const { citations } = extractCitationsFromSyllabus(`Test, Author (1968) "Synthetic Economics Title One," Example Journal of Economics, Vol. 76, pp. 169-217.
Sample, Author (1970) "Synthetic Economics Title Two," Example Journal of Economics, Vol. 78, pp. 526-536.`);

    expect(citations).toEqual([
      'Test, Author (1968) "Synthetic Economics Title One," Example Journal of Economics, Vol. 76, pp. 169-217.',
      'Sample, Author (1970) "Synthetic Economics Title Two," Example Journal of Economics, Vol. 78, pp. 526-536.',
    ]);
  });

  it('splits consecutive author-first quoted-title citations in inline text', () => {
    const { citations } = extractCitationsFromSyllabus(
      'Test Author, “A Synthetic Citation Parsing Title,” Example Journal 60, 2 (June 2014): 5-28. Example Author, “A Synthetic Atlantic Research Topic,” Example History Journal 117, 1 (2012): 40-66.'
    );

    expect(citations).toEqual([
      'Test Author, “A Synthetic Citation Parsing Title,” Example Journal 60, 2 (June 2014): 5-28.',
      'Example Author, “A Synthetic Atlantic Research Topic,” Example History Journal 117, 1 (2012): 40-66.',
    ]);
  });

  it('detects MLA-style citations with vol and pp markers', () => {
    const { citations } = extractCitationsFromSyllabus(
      'Example, Author. “Choosing a Synthetic Topic for Research.” Example Framework, vol. 36, 1989, pp. 15-23.'
    );

    expect(citations).toEqual([
      'Example, Author. “Choosing a Synthetic Topic for Research.” Example Framework, vol. 36, 1989, pp. 15-23.',
    ]);
  });

  it('splits consecutive APA citations pasted on adjacent lines without blank lines', () => {
    const { citations } = extractCitationsFromSyllabus(`Test Author A., Sample Author B., & Example Author C. (2021). Planning a synthetic study using example research methods. Example Computer Journal, 192, 3123–3133. https://doi.org/10.1234/example.2021.0001
Example, Author (2025). Synthetic Neural Activity Research Methods. Example Press. https://doi.org/10.1234/test.neural.2025`);

    expect(citations).toEqual([
      'Test Author A., Sample Author B., & Example Author C. (2021). Planning a synthetic study using example research methods. Example Computer Journal, 192, 3123–3133. https://doi.org/10.1234/example.2021.0001',
      'Example, Author (2025). Synthetic Neural Activity Research Methods. Example Press. https://doi.org/10.1234/test.neural.2025',
    ]);
  });

  it('keeps slash-style edited book citations intact instead of splitting at editor initials', () => {
    const { citations } = extractCitationsFromSyllabus(
      'Synthetic Research Topics / edited by Example Editor A., Sample Editor B., and Test Editor C. (1st ed. 2014.). Example Press New York'
    );

    expect(citations).toEqual([
      'Synthetic Research Topics / edited by Example Editor A., Sample Editor B., and Test Editor C. (1st ed. 2014.). Example Press New York',
    ]);
  });

  it('keeps yearless and yearful citations together', () => {
    const result = extractCitationsFromSyllabus(`Example Author, “A Synthetic Collection and Its Modern Context.” In Example Books on a Sample Topic, edited by Example Editor and Sample Editor (Example City: Example University Press), 190-215

Sample Author, “A Synthetic History” in Example Book: Research and Production (Example Press, 1995)`);

    expect(result.citations).toHaveLength(2);
    expect(result.citations[0]).toContain('Example Author');
    expect(result.citations[1]).toContain('Sample Author');
    expect(result.skipped).toEqual([]);
  });

  it('accepts a yearless edited chapter with a university press', () => {
    const result = extractCitationsFromSyllabus(
      'Test Author, “Archives and a Synthetic Study.” In Example Studies, edited by Sample Editor (Example University Press), 20-37'
    );

    expect(result.citations).toHaveLength(1);
    expect(result.skipped).toEqual([]);
  });

  it.each([
    ['quoted title', 'Test Author, “A Synthetic History”'],
    ['ed. marker', 'Example, Author. ed. Synthetic Research Essays'],
    ['eds. marker', 'Example, Author. eds. Synthetic Research Essays'],
    ['publisher marker', 'Example, Author. Example Publishing'],
    ['page range', 'Example, Author. Synthetic research, 190–215'],
  ])('accepts a yearless author citation with a %s signal', (_signal, text) => {
    const result = extractCitationsFromSyllabus(text);

    expect(result.citations).toEqual([text]);
    expect(result.skipped).toEqual([]);
  });

  it('returns syllabus headers and short junk as skipped blocks', () => {
    const result = extractCitationsFromSyllabus(`Week 3

Read before class

Test Author, “A Synthetic Citation Parsing Title,” Example Journal 60, 2 (June 2014): 5-28`);

    expect(result.citations).toHaveLength(1);
    expect(result.skipped).toEqual(['Week 3', 'Read before class']);
  });
});
