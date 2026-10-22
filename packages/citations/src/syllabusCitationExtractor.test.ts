import { describe, expect, it } from 'vitest';

import { parseCitation } from './citationParser';
import { extractCitationsFromSyllabus } from './syllabusCitationExtractor';

const ONE_ENTRY_PER_LINE_SYLLABUS = `Synthetic Course Title
Sources for library acquisition
Please include each item in the course site.
Instructor: Synthetic Instructor
The Architecture of Memory
Synthetic Author, “A Sample Journal Article,” Example Journal 11 (2020): 1–8.
Sample Author, “A Chapter about Test Collections.” In Example Editors ed., Sample Reader (Example City: Test Press, 2018), pp. 40–58.
Test Author and Example Scholar, “Two Authors in a Sample Journal,” Example Quarterly 12 (2021): 10–21.
Stories and Oral Tradition
First M. M. Example, “An Initialed Author in a Test Journal,” Example Review 8 (2016): 4–16.
Demo Scholar et al., “A Synthetic Group Study,” Example Journal 14 (2022): 5–19.
Researcher, Example. “A Topic in Sample Histories.” Example History Review 20 (2019): 10–24.
Schools and Communities
Sample Author, “A Study of Test Communities,” Example Journal 10 (2017): 2–15.
Example Scholar, “A Chapter for Testing.” In Sample Editors ed., Synthetic Reader (Example City: Sample Press, 2019), pp. 22–39.
Test Researcher, “A Sample School Article,” Example Review 18 (2023): 30–44.
Labor and Public Life
Sample Author, “A Two-Part Study: Section One and Section Two,” Example Journal 15 (2020): 2–18.
Example Scholar, “A Synthetic Labor Article,” Example Quarterly 8 (2015): 7–20.
Film: Sample Film Alpha - a synthetic class note [https://example.test/alpha]
Language and Identity
Demo Author, “A Test Language Article,” Example Review 17 (2018): 5–19.
Test Scholar, “A Sample Identity Chapter.” In Example Editors ed., Test Reader (Sample City: Example Press, 2017), pp. 60–77.
Sample Film Beta (film) [https://example.test/beta] - show in class
Changing Landscapes
Example Author, “A Synthetic Landscape Study,” Example Journal 16 (2016): 12–30.
Demo Scholar, “A Test Environment Chapter.” In Sample Editors ed., Example Reader (Test City: Sample Press, 2020), pp. 9–25.
Researcher, Test. “A Sample Climate Article.” Example Quarterly 23 (2024): 15–36.
Music and Social Change
Film: Sample Documentary Gamma [https://example.test/gamma] - reserve screening
Test Author, “A Synthetic Music Article,” Example Review 7 (2014): 3–12.
Example Scholar, “A Sample Culture Study,” Example Journal 19 (2021): 20–38.
Movement and Belonging
Sample Scholar, “A Chapter about Test Movements.” In Example Editors ed., Synthetic Reader (Sample City: Test Press, 2021), pp. 75–92.
Demo Author, “A Sample Belonging Article,” Example Quarterly 15 (2019): 11–28.
Synthetic Reporter, “A Test Newspaper Interactive.” Example Daily, 2023. https://example.test/interactive
Images and Evidence
Example Researcher, “A Sample Image Article,” Example Journal 9 (2013): 1–14.
Sample Movie Delta (film) - a synthetic screening note [https://example.test/delta]
Test Scholar, “A Study of Sample Evidence,” Example Review 22 (2022): 6–19.
Public Stories
Demo Author, “A Synthetic Public History Article,” Example Journal 21 (2020): 18–34.
Sample Author, “A Test Story Chapter.” In Example Editors ed., Synthetic Reader (Test City: Sample Press, 2016), pp. 31–48.
Researcher, Example. “A Sample Memory Article.” Example Quarterly 12 (2015): 9–23.
Newspaper Collections
Synthetic Web Resource Guide [https://example.test/guide]
Example Scholar, “A Sample Newspaper Study,” Example Review 13 (2018): 4–17.
Classroom Resources
Test Author, “A Synthetic Classroom Article,” Example Journal 24 (2023): 25–42.
Sample Author, “A Chapter for Example Courses.” In Sample Editors ed., Test Reader (Example City: Example Press, 2022), pp. 12–29.`;

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

  it('extracts one entry per line with generic headings, media URLs, and a web resource', () => {
    const result = extractCitationsFromSyllabus(ONE_ENTRY_PER_LINE_SYLLABUS);
    const expectedHeadings = [
      ...Array(3).fill('The Architecture of Memory'),
      ...Array(3).fill('Stories and Oral Tradition'),
      ...Array(3).fill('Schools and Communities'),
      ...Array(3).fill('Labor and Public Life'),
      ...Array(3).fill('Language and Identity'),
      ...Array(3).fill('Changing Landscapes'),
      ...Array(3).fill('Music and Social Change'),
      ...Array(3).fill('Movement and Belonging'),
      ...Array(3).fill('Images and Evidence'),
      ...Array(3).fill('Public Stories'),
      ...Array(2).fill('Newspaper Collections'),
      ...Array(2).fill('Classroom Resources'),
    ];

    expect(result.entries).toHaveLength(34);
    expect(result.entries.map(({ heading }) => heading)).toEqual(expectedHeadings);
    expect(result.skipped).toEqual([
      'Synthetic Course Title',
      'Sources for library acquisition',
      'Please include each item in the course site.',
      'Instructor: Synthetic Instructor',
    ]);

    const media = result.entries.filter(({ type }) => type === 'media');
    expect(media.map(({ text, url }) => [text, url])).toEqual([
      ['Sample Film Alpha', 'https://example.test/alpha'],
      ['Sample Film Beta', 'https://example.test/beta'],
      ['Sample Documentary Gamma', 'https://example.test/gamma'],
      ['Sample Movie Delta', 'https://example.test/delta'],
    ]);
    expect(result.entries.find(({ type }) => type === 'web')).toMatchObject({
      text: 'Synthetic Web Resource Guide',
      heading: 'Newspaper Collections',
      url: 'https://example.test/guide',
    });
    expect(result.entries.find(({ text }) => text.includes('A Two-Part Study'))?.text).toContain('Section Two');
    expect(result.citations).toEqual(result.entries.filter(({ type }) => type === 'citation').map(({ text }) => text));
    expect(result.citations).toHaveLength(29);

    for (const entry of result.entries.filter(({ type }) => type === 'citation')) {
      const author = parseCitation(entry.text).author;
      expect(author).not.toContain(entry.heading);
    }
    expect(parseCitation(result.entries.find(({ text }) => text.includes('Two Authors in a Sample Journal'))!.text).author)
      .toBe('Test Author and Example Scholar');
    expect(parseCitation(result.entries.find(({ text }) => text.includes('Initialed Author'))!.text).author)
      .toBe('First M. M. Example');
    expect(parseCitation(result.entries.find(({ text }) => text.includes('Synthetic Group Study'))!.text).author)
      .toBe('Demo Scholar et al.');
  });
});
