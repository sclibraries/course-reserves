import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {
  executeCitationBatchSearch,
  parseEBSCORecords,
  prepareCitationSearches,
  readSyllabusFile as readSharedSyllabusFile,
} from '@course-reserves/citations';
import { resourceApi } from './course/resourceApi';
import { requestWorkflow, workflowPath } from './workflowRequest';

export async function getGoogleDocText(url) {
  const response = await requestWorkflow(workflowPath('workflowSyllabi', 'googleDocText'), {
    method: 'POST',
    body: { google_doc_url: url },
  });
  return response.extracted_text;
}

export function readSyllabusFile(file) {
  return readSharedSyllabusFile(file, {
    loadPdfJs: async () => {
      const pdfjs = await import('pdfjs-dist');
      pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
      return pdfjs;
    },
    loadMammoth: () => import('mammoth'),
  });
}

export async function searchSyllabusEntries(entries, onProgress) {
  const searches = prepareCitationSearches(entries.map(({ text }) => text), entries.map(({ id }) => id));
  return executeCitationBatchSearch(searches, async (query) => {
    const response = await resourceApi.searchEDS(toSearchQuery(query));
    const { records, statistics } = response.data;
    return {
      results: parseEBSCORecords(records),
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
