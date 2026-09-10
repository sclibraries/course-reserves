import { describe, expect, it } from 'vitest';

import { extractCitationsFromSyllabus } from './syllabusCitationExtractor';

describe('extractCitationsFromSyllabus', () => {
  it('detects a single-line quoted-title citation with author-first formatting', () => {
    const citations = extractCitationsFromSyllabus(
      'Melanie Newton, “The Race Leapt at Sauteurs: Genocide, Narrative and Indigenous Exile from the Caribbean,” Caribbean Quarterly 60, 2 (June 2014): 5-28'
    );

    expect(citations).toEqual([
      'Melanie Newton, “The Race Leapt at Sauteurs: Genocide, Narrative and Indigenous Exile from the Caribbean,” Caribbean Quarterly 60, 2 (June 2014): 5-28',
    ]);
  });

  it('keeps a wrapped APA citation together when the title follows the year', () => {
    const citations = extractCitationsFromSyllabus(`Słupińska, K., Duda, J., & Biercewicz, K. (2021). Planning an experiment in a
          virtual environment reality as a place of research on human behaviour using
          methods of neuroscience measurement – bibliometric analysis and methodological
          approach. Procedia Computer Science, 192, 3123–3133.
          https://doi.org/10.1016/j.procs.2021.09.085`);

    expect(citations).toEqual([
      'Słupińska, K., Duda, J., & Biercewicz, K. (2021). Planning an experiment in a virtual environment reality as a place of research on human behaviour using methods of neuroscience measurement – bibliometric analysis and methodological approach. Procedia Computer Science, 192, 3123–3133. https://doi.org/10.1016/j.procs.2021.09.085',
    ]);
  });

  it('can still split consecutive citations when there are no blank lines', () => {
    const citations = extractCitationsFromSyllabus(`Becker, Gary (1968) "Crime and Punishment: An Economics Analysis," Journal of Political Economy, Vol. 76, pp. 169-217.
Stigler, George (1970) "The Optimum Enforcement of Laws," Journal of Political Economy, Vol. 78, pp. 526-536.`);

    expect(citations).toEqual([
      'Becker, Gary (1968) "Crime and Punishment: An Economics Analysis," Journal of Political Economy, Vol. 76, pp. 169-217.',
      'Stigler, George (1970) "The Optimum Enforcement of Laws," Journal of Political Economy, Vol. 78, pp. 526-536.',
    ]);
  });

  it('splits consecutive author-first quoted-title citations in inline text', () => {
    const citations = extractCitationsFromSyllabus(
      'Melanie Newton, “The Race Leapt at Sauteurs: Genocide, Narrative and Indigenous Exile from the Caribbean,” Caribbean Quarterly 60, 2 (June 2014): 5-28. Ada Ferrer, “Haiti, Free Soil, and Antislavery in the Revolutionary Atlantic,” American Historical Review 117, 1 (2012): 40-66.'
    );

    expect(citations).toEqual([
      'Melanie Newton, “The Race Leapt at Sauteurs: Genocide, Narrative and Indigenous Exile from the Caribbean,” Caribbean Quarterly 60, 2 (June 2014): 5-28.',
      'Ada Ferrer, “Haiti, Free Soil, and Antislavery in the Revolutionary Atlantic,” American Historical Review 117, 1 (2012): 40-66.',
    ]);
  });

  it('detects MLA-style citations with vol and pp markers', () => {
    const citations = extractCitationsFromSyllabus(
      'hooks, bell. “Choosing the Margin as a Space of Radical Openness.” Framework, vol. 36, 1989, pp. 15-23.'
    );

    expect(citations).toEqual([
      'hooks, bell. “Choosing the Margin as a Space of Radical Openness.” Framework, vol. 36, 1989, pp. 15-23.',
    ]);
  });

  it('splits consecutive APA citations pasted on adjacent lines without blank lines', () => {
    const citations = extractCitationsFromSyllabus(`Słupińska, K., Duda, J., & Biercewicz, K. (2021). Planning an experiment in a virtual environment reality as a place of research on human behaviour using methods of neuroscience measurement – bibliometric analysis and methodological approach. Procedia Computer Science, 192, 3123–3133. https://doi.org/10.1016/j.procs.2021.09.085
Feng, Z. (2025). Electrical Brain Stimulation: Mechanisms and Modulation of Neuronal Activity. Springer Nature. https://doi.org/10.1007/978-981-95-4145-4`);

    expect(citations).toEqual([
      'Słupińska, K., Duda, J., & Biercewicz, K. (2021). Planning an experiment in a virtual environment reality as a place of research on human behaviour using methods of neuroscience measurement – bibliometric analysis and methodological approach. Procedia Computer Science, 192, 3123–3133. https://doi.org/10.1016/j.procs.2021.09.085',
      'Feng, Z. (2025). Electrical Brain Stimulation: Mechanisms and Modulation of Neuronal Activity. Springer Nature. https://doi.org/10.1007/978-981-95-4145-4',
    ]);
  });

  it('keeps slash-style edited book citations intact instead of splitting at editor initials', () => {
    const citations = extractCitationsFromSyllabus(
      'Vascular Mechanisms in CNS Trauma / edited by Eng H. Lo, Josephine Lok, MingMing Ning, Michael J. Whalen (1st ed. 2014.). Springer New York'
    );

    expect(citations).toEqual([
      'Vascular Mechanisms in CNS Trauma / edited by Eng H. Lo, Josephine Lok, MingMing Ning, Michael J. Whalen (1st ed. 2014.). Springer New York',
    ]);
  });
});