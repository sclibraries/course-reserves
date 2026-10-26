import type { DiscoveryFacets } from './discoverySearchTypes';

export function parseDiscoveryFacets(rawFacets: unknown[] = []): DiscoveryFacets {
  const facets = rawFacets.filter(isFacet);
  const sourceFacet = facets.find((facet) => /source.?type/i.test(`${facet.Id || facet.FacetId || ''} ${facet.Label || facet.Name || ''}`));
  const yearFacet = facets.find((facet) => /publication.?date|year/i.test(`${facet.Id || facet.FacetId || ''} ${facet.Label || facet.Name || ''}`));

  return {
    sourceTypes: facetValues(sourceFacet),
    publicationYears: facetValues(yearFacet).filter((value) => /^\d{4}$/.test(value)),
  };
}

function isFacet(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object');
}

function facetValues(facet?: Record<string, unknown>): string[] {
  const values = facet?.Values || facet?.AvailableFacetValues;
  if (!Array.isArray(values)) return [];
  return values.map((value) => {
    if (!value || typeof value !== 'object') return '';
    const item = value as Record<string, unknown>;
    return typeof item.Value === 'string' ? item.Value : '';
  }).filter(Boolean);
}
