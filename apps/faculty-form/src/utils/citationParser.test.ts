import { describe, expect, it } from 'vitest';

import { parseCitation } from './citationParser';

describe('parseCitation', () => {
  it('parses APA-style journal citations with a DOI URL', () => {
    const parsed = parseCitation(
      'Fróes, M. M. (2015). An artsci science. Technoetic Arts: A Journal of Speculative Research, 13(1/2), 203–217. https://doi.org/10.1386/tear.13.1-2.203_1'
    );

    expect(parsed).toEqual({
      author: 'Fróes, M. M.',
      title: 'An artsci science',
      source: 'Technoetic Arts: A Journal of Speculative Research',
    });
  });

  it('parses multiline APA-style citations with multiple authors and a DOI URL', () => {
    const parsed = parseCitation(`Słupińska, K., Duda, J., & Biercewicz, K. (2021). Planning an experiment in a
          virtual environment reality as a place of research on human behaviour using
          methods of neuroscience measurement – bibliometric analysis and methodological
          approach. Procedia Computer Science, 192, 3123–3133.
          https://doi.org/10.1016/j.procs.2021.09.085`);

    expect(parsed).toEqual({
      author: '',
      title:
        'Planning an experiment in a virtual environment reality as a place of research on human behaviour using methods of neuroscience measurement – bibliometric analysis and methodological approach',
      source: 'Procedia Computer Science',
    });
  });

  it('keeps quoted-title citations working', () => {
    const parsed = parseCitation(
      'Melanie Newton, "The Race Leapt at Sauteurs: Genocide, Narrative and Indigenous Exile from the Caribbean," Caribbean Quarterly 60, 2 (June 2014): 5-28'
    );

    expect(parsed).toEqual({
      author: 'Melanie Newton',
      title: 'The Race Leapt at Sauteurs: Genocide, Narrative and Indigenous Exile from the Caribbean',
      source: 'Caribbean Quarterly',
    });
  });

  it('drops the author field for quoted citations with multiple authors', () => {
    const parsed = parseCitation(
      'Alissa Trotz and Beverley Mullings, "Transnational Migration, the State, and Development: Reflecting on the "Diasporic Option"," Small Axe 41 (2013): 154-171.'
    );

    expect(parsed).toEqual({
      author: '',
      title: 'Transnational Migration, the State, and Development: Reflecting on the "Diasporic Option"',
      source: 'Small Axe',
    });
  });

  it('parses book chapters whose source titles contain numbers', () => {
    const parsed = parseCitation(
      'Havelock R. H. Ross-Brewster, "Identity, Space and the West Indian Union," in Kenneth Hall and Denis Benn eds., Contending with Destiny: The Caribbean in the 21st Century (Kingston, Jamaica: Ian Randle Publishers, 2000), 37-44'
    );

    expect(parsed).toEqual({
      author: 'Havelock R. H. Ross-Brewster',
      title: 'Identity, Space and the West Indian Union',
      source: 'Contending with Destiny: The Caribbean in the 21st Century',
    });
  });

  it('parses MLA-style quoted articles with volume and page markers', () => {
    const parsed = parseCitation(
      'hooks, bell. “Choosing the Margin as a Space of Radical Openness.” Framework, vol. 36, 1989, pp. 15-23.'
    );

    expect(parsed).toEqual({
      author: 'hooks, bell.',
      title: 'Choosing the Margin as a Space of Radical Openness',
      source: 'Framework',
    });
  });

  it('parses slash-style edited book citations without treating editors as authors', () => {
    const parsed = parseCitation(
      'Vascular Mechanisms in CNS Trauma / edited by Eng H. Lo, Josephine Lok, MingMing Ning, Michael J. Whalen (1st ed. 2014.). Springer New York'
    );

    expect(parsed).toEqual({
      author: '',
      title: 'Vascular Mechanisms in CNS Trauma',
      source: 'Springer New York',
    });
  });

  it('parses author-year citations whose title is a slash-style edited book', () => {
    const parsed = parseCitation(
      'Lo, E. H., Lok, J., Ning, M., Whalen, M. J., & SpringerLink (Online service). (2014). Vascular Mechanisms in CNS Trauma / edited by Eng H. Lo, Josephine Lok, MingMing Ning, Michael J. Whalen (1st ed. 2014.). Springer New York.'
    );

    expect(parsed).toEqual({
      author: '',
      title: 'Vascular Mechanisms in CNS Trauma',
      source: 'Springer New York',
    });
  });
});