import type { CitationSearchResult } from './citationBatchSearch';

export interface EBSCOItemGroup {
  Label: string;
  Group: string;
  Data: string;
  CleanData: string | string[];
}

export interface EBSCOFullTextLink {
  Category: string;
  Icon: string;
  MouseOverText: string;
  Name: string;
  Text: string;
  Url: string;
}

export interface EDSHoldingCopy {
  Sublocation?: string;
  ShelfLocator?: string;
}

export interface EBSCORecord {
  AccessLevel: string;
  pubType: string;
  PubTypeId: string;
  ResultId: number | string;
  DbId: string;
  DbLabel: string;
  An: string;
  PLink: string;
  PDF?: string;
  HTML?: string;
  FullText?: string;
  ImageInfo?: string | Record<string, string>;
  FullTextCustomLinks?: EBSCOFullTextLink[];
  CustomLinks?: EBSCOFullTextLink[];
  Items: Record<string, EBSCOItemGroup[]>;
  RecordInfo?: {
    BibEntity?: {
      Titles?: Array<{ TitleFull: string; Type: string }>;
      Languages?: Array<{ Code: string; Text: string }>;
      Subjects?: Array<{ SubjectFull: string; Type: string }>;
      Identifiers?: Array<{ Type: string; Value: string }>;
      PhysicalDescription?: unknown;
    };
    BibRelationships?: {
      HasContributorRelationships?: Array<{ NameFull: string }>;
      IsPartOfRelationships?: {
        date?: Array<{ Y: string; M: string; D: string; Type: string }>;
        Identifiers?: Array<{ Type: string; Value: string }>;
        Titles?: Array<{ TitleFull: string; Type: string }>;
        numbering?: Array<{ Type: string; Value: string }>;
      };
    };
  };
  Holdings?: Array<{
    HoldingSimple?: {
      CopyInformationList?: EDSHoldingCopy[];
    };
  }>;
}

export interface DiscoverySearchResult extends CitationSearchResult {
  id: string;
  dbId: string;
  authors: string[];
  publicationType: string;
  publicationInfo?: string;
  subjects?: string[];
  abstract?: string;
  isbn?: string;
  issn?: string;
  doi?: string;
  url?: string;
  fullTextUrl?: string;
  callNumber?: string;
  location?: string;
  holdings?: EDSHoldingCopy[];
  database: string;
  pLink: string;
  languages?: string[];
  publicationDate?: { year?: string; month?: string; day?: string };
  journalTitle?: string;
  issueNumber?: string;
  volumeNumber?: string;
  edition?: string;
  publisher?: string;
  fileDescription?: string;
  additionalUrls?: string[];
  fullTextLinks?: EBSCOFullTextLink[];
  hasFullText: boolean;
}

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
