import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {
  executeCitationBatchSearch,
  extractSyllabusText,
  prepareCitationSearches,
} from '@course-reserves/citations';
import { resourceApi } from './course/resourceApi';
import { requestWorkflow, workflowPath } from './workflowRequest';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const MIME_BY_EXTENSION = { pdf: 'application/pdf', docx: DOCX_MIME };
const MAX_FILE_BYTES = 10 * 1024 * 1024;

export async function getGoogleDocText(url) {
  const response = await requestWorkflow(workflowPath('workflowSyllabi', 'googleDocText'), {
    method: 'POST',
    body: { google_doc_url: url },
  });
  return response.extracted_text;
}

export async function readSyllabusFile(file) {
  if (file.size > MAX_FILE_BYTES) throw new Error('This file is over the 10 MB limit. Choose a smaller PDF or DOCX.');
  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  const mimeType = MIME_BY_EXTENSION[extension];
  if (!mimeType || (file.type && file.type !== mimeType)) throw new Error('Choose a PDF or DOCX file.');

  const content = await file.arrayBuffer();
  const pdfjs = mimeType === 'application/pdf' ? await import('pdfjs-dist') : undefined;
  const mammoth = mimeType === DOCX_MIME ? await import('mammoth') : undefined;
  if (pdfjs) pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  const text = await extractSyllabusText(content, mimeType, pdfjs, mammoth);
  return {
    text,
    attachment: {
      filename: file.name,
      mime_type: mimeType,
      content_base64: toBase64(content),
      extracted_text: text,
    },
  };
}

export async function searchSyllabusEntries(entries, onProgress) {
  const searches = prepareCitationSearches(entries.map(({ text }) => text), entries.map(({ id }) => id));
  return executeCitationBatchSearch(searches, async (query) => {
    const response = await resourceApi.searchEDS(toSearchQuery(query));
    const { records, statistics } = response.data;
    return {
      results: records.map(normalizeEdsRecord),
      totalHits: statistics.TotalHits,
      searchTime: statistics.TotalSearchTime,
    };
  }, undefined, { onProgress });
}

export function createStaffSyllabusSubmission(body) {
  return requestWorkflow(workflowPath('workflowSyllabi', 'staffEnteredSubmission'), {
    method: 'POST',
    body,
  });
}

function toSearchQuery(query) {
  if (!Array.isArray(query)) return query;
  return query.map(({ field, term, boolean }) => `${boolean ? `${boolean} ` : ''}${field} (${term})`).join(' ');
}

function normalizeEdsRecord(record) {
  const items = record.Items || {};
  const bib = record.RecordInfo?.BibEntity;
  const part = record.RecordInfo?.BibRelationships?.IsPartOfRelationships;
  const identifiers = [...(bib?.Identifiers || []), ...(part?.Identifiers || [])];
  const getValues = (key) => {
    const value = items[key]?.[0]?.CleanData;
    return Array.isArray(value) ? value.filter(Boolean) : value ? [value] : [];
  };
  const date = part?.date?.[0];
  const numbering = part?.numbering || [];
  const links = [...(record.FullTextCustomLinks || []), ...(record.CustomLinks || [])];
  const identifier = (type) => identifiers.find((item) => item.Type.toLowerCase().includes(type))?.Value;

  return {
    id: record.An,
    dbId: record.DbId,
    title: getValues('Ti')[0] || bib?.Titles?.[0]?.TitleFull || 'Untitled',
    authors: getValues('Au'),
    publicationType: record.pubType || 'Unknown',
    publicationInfo: getValues('Src')[0],
    isbn: identifier('isbn'),
    issn: identifier('issn'),
    doi: identifier('doi'),
    journalTitle: part?.Titles?.[0]?.TitleFull,
    volumeNumber: numbering.find((item) => item.Type.toLowerCase() === 'volume')?.Value,
    issueNumber: numbering.find((item) => item.Type.toLowerCase() === 'issue')?.Value,
    publicationDate: date ? { year: date.Y } : undefined,
    publisher: getValues('Pub')[0],
    url: getValues('URL')[0],
    fullTextUrl: links.find((link) => link.Url)?.Url,
    pLink: record.PLink || '',
    fileDescription: getValues('SrcInfo')[0],
  };
}

function toBase64(content) {
  const bytes = new Uint8Array(content);
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}
