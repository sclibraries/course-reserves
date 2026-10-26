import type { EditableCitation } from './pasteCitationTypes';

export interface CitationReviewSection {
  heading: string | null;
  citations: Array<{ citation: EditableCitation; index: number }>;
}

export function groupCitationsByHeading(citations: EditableCitation[]): CitationReviewSection[] {
  const sections: CitationReviewSection[] = [];
  citations.forEach((citation, index) => {
    const heading = citation.heading?.trim() || null;
    let section = sections.find((candidate) => candidate.heading === heading);
    if (!section) {
      section = { heading, citations: [] };
      sections.push(section);
    }
    section.citations.push({ citation, index });
  });
  return sections;
}
