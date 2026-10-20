import type {
  DiscoveryFacets,
  DiscoverySearchResult,
  EBSCOItemGroup,
  EBSCORecord,
} from './discoverySearchTypes';

export function parseEBSCORecords(records: EBSCORecord[]): DiscoverySearchResult[] {
  return records.map(parseEBSCORecord);
}

export function parseEBSCORecord(record: EBSCORecord): DiscoverySearchResult {
  const itemGroups = Object.values(record.Items || {}).flat();
  const bib = record.RecordInfo?.BibEntity;
  const partOf = record.RecordInfo?.BibRelationships?.IsPartOfRelationships;
  const identifiers = [...(bib?.Identifiers || []), ...(partOf?.Identifiers || [])];
  const date = partOf?.date?.[0];
  const links = [...(record.FullTextCustomLinks || []), ...(record.CustomLinks || [])];
  const authors = cleanValues(record.Items?.Au?.[0]?.CleanData);
  const contributors = record.RecordInfo?.BibRelationships?.HasContributorRelationships?.map((person) => person.NameFull) || [];
  const subjects = cleanValues(record.Items?.Su?.[0]?.CleanData);
  const subjectList = subjects.length > 0 ? subjects : (bib?.Subjects || []).map((subject) => subject.SubjectFull);
  const url = cleanValues(record.Items?.URL?.[0]?.CleanData)[0];
  const relationUrls = findGroup(record.Items?.SrcInfo, /relation/i);
  const holdings = record.Holdings?.flatMap((group) => group.HoldingSimple?.CopyInformationList || []) || [];
  const firstHolding = holdings[0];
  const abstracts = cleanValues(record.Items?.Ab?.[0]?.CleanData);
  const publicationInfo = cleanValues(record.Items?.Src?.[0]?.CleanData)[0];
  const sourceType = record.pubType || 'Unknown';

  return {
    id: record.An,
    dbId: record.DbId,
    title: cleanValues(record.Items?.Ti?.[0]?.CleanData)[0] || bib?.Titles?.[0]?.TitleFull || 'Untitled',
    authors: authors.length > 0 ? authors : contributors,
    publicationType: sourceType,
    publicationInfo,
    subjects: subjectList,
    abstract: abstracts[0],
    isbn: identifierValue(identifiers, 'isbn'),
    issn: identifierValue(identifiers, 'issn'),
    doi: identifierValue(identifiers, 'doi'),
    url,
    fullTextUrl: links.find((link) => link.Url)?.Url,
    fullTextLinks: links,
    callNumber: firstHolding?.ShelfLocator,
    location: firstHolding?.Sublocation,
    holdings,
    database: record.DbLabel,
    pLink: record.PLink,
    languages: bib?.Languages?.map((language) => language.Text).filter(Boolean),
    publicationDate: date ? { year: date.Y, month: date.M, day: date.D } : undefined,
    journalTitle: partOf?.Titles?.[0]?.TitleFull,
    issueNumber: partOf?.numbering?.find((number) => number.Type.toLowerCase() === 'issue')?.Value,
    volumeNumber: partOf?.numbering?.find((number) => number.Type.toLowerCase() === 'volume')?.Value,
    edition: firstGroupValue(itemGroups, /edition/i),
    publisher: firstGroupValue(itemGroups, /publisher|publishing/i) || firstGroupValue(itemGroups, /^pub$/i),
    fileDescription: findGroup(record.Items?.SrcInfo, /file description/i),
    additionalUrls: typeof relationUrls === 'string' ? [relationUrls] : relationUrls,
    hasFullText: Boolean(record.FullText || record.PDF || record.HTML || links.some((link) => Boolean(link.Url))),
  };
}

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

function cleanValues(value?: string | string[]): string[] {
  if (Array.isArray(value)) return value.filter(Boolean);
  return value ? [value] : [];
}

function findGroup(groups: EBSCOItemGroup[] | undefined, pattern: RegExp): string | string[] | undefined {
  const item = groups?.find((candidate) => pattern.test(`${candidate.Label} ${candidate.Group}`));
  return item?.CleanData;
}

function firstGroupValue(groups: EBSCOItemGroup[], pattern: RegExp): string | undefined {
  const value = findGroup(groups, pattern);
  return Array.isArray(value) ? value[0] : value;
}

function identifierValue(identifiers: Array<{ Type: string; Value: string }>, type: string): string | undefined {
  return identifiers.find((identifier) => identifier.Type.toLowerCase().includes(type))?.Value;
}
