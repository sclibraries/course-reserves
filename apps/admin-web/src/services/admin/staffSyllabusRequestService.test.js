import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createStaffSyllabusSubmission,
  getGoogleDocText,
  readSyllabusFile,
  searchSyllabusEntries,
} from './staffSyllabusRequestService';

const mocks = vi.hoisted(() => ({
  requestWorkflow: vi.fn(),
  searchEDS: vi.fn(),
  pdfjs: { getDocument: vi.fn(), GlobalWorkerOptions: { workerSrc: '' } },
  mammoth: { default: { extractRawText: vi.fn() } },
}));

vi.mock('./workflowRequest', async (importOriginal) => ({
  ...await importOriginal(),
  requestWorkflow: mocks.requestWorkflow,
}));
vi.mock('./course/resourceApi', () => ({ resourceApi: { searchEDS: mocks.searchEDS } }));
vi.mock('pdfjs-dist', () => mocks.pdfjs);
vi.mock('mammoth', () => mocks.mammoth);
vi.mock('pdfjs-dist/build/pdf.worker.min.mjs?url', () => ({ default: '/pdf.worker.mjs' }));

const file = (name, type) => Object.assign(new File(['bytes'], name, { type }), {
  arrayBuffer: vi.fn().mockResolvedValue(new Uint8Array([1, 2]).buffer),
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.pdfjs.GlobalWorkerOptions.workerSrc = '';
  mocks.pdfjs.getDocument.mockReturnValue({
    promise: Promise.resolve({
      numPages: 1,
      getPage: async () => ({
        getTextContent: async () => ({ items: [{ str: 'Week 1', hasEOL: true }] }),
      }),
    }),
    destroy: vi.fn().mockResolvedValue(undefined),
  });
  mocks.mammoth.default.extractRawText.mockResolvedValue({ value: 'Week 2\nSynthetic reading' });
});

describe('staffSyllabusRequestService', () => {
  it('reads Google Doc text through the staff syllabus endpoint', async () => {
    mocks.requestWorkflow.mockResolvedValue({ extracted_text: 'Week 1\nSynthetic reading' });

    await expect(getGoogleDocText('https://docs.google.com/document/d/synthetic/edit'))
      .resolves.toBe('Week 1\nSynthetic reading');
    expect(mocks.requestWorkflow).toHaveBeenCalledWith('/workflow/syllabus/google-doc-text', {
      method: 'POST',
      body: { google_doc_url: 'https://docs.google.com/document/d/synthetic/edit' },
    });
  });

  it('extracts PDF text with the loaded pdfjs module and keeps upload data', async () => {
    const syllabus = await readSyllabusFile(file('synthetic.pdf', 'application/pdf'));

    expect(syllabus).toEqual({
      text: 'Week 1',
      payload: {
        filename: 'synthetic.pdf',
        mime_type: 'application/pdf',
        content_base64: 'AQI=',
        extracted_text: 'Week 1',
      },
    });
    expect(mocks.pdfjs.GlobalWorkerOptions.workerSrc).toBe('/pdf.worker.mjs');
  });

  it('extracts DOCX text with the loaded mammoth module', async () => {
    const syllabus = await readSyllabusFile(file(
      'synthetic.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ));

    expect(syllabus.text).toBe('Week 2\nSynthetic reading');
    expect(mocks.mammoth.default.extractRawText).toHaveBeenCalledWith({ arrayBuffer: expect.any(ArrayBuffer) });
    expect(syllabus.payload).toMatchObject({ filename: 'synthetic.docx', mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  });

  it('submits the API-098 payload on the staff-entered endpoint', async () => {
    const body = { folio_course_listing_id: 'listing-21', items: [{ resource_data: { title: 'Synthetic' } }] };
    mocks.requestWorkflow.mockResolvedValue({ submission_id: 42, submission_uuid: 'synthetic-uuid' });

    await expect(createStaffSyllabusSubmission(body)).resolves.toEqual({ submission_id: 42, submission_uuid: 'synthetic-uuid' });
    expect(mocks.requestWorkflow).toHaveBeenCalledWith('/workflow/submission/staff-entered', {
      method: 'POST',
      body,
    });
  });

  it('searches through admin EDS and returns normalized structural records with progress', async () => {
    mocks.searchEDS.mockResolvedValue({
      data: {
        records: [{
          An: 'synthetic-an',
          DbId: 'synthetic-db',
          PLink: 'https://example.test/record/1',
          pubType: 'Academic Journal',
          Items: {
            Ti: [{ CleanData: ['Synthetic Article'] }],
            Au: [{ CleanData: ['Test Author'] }],
          },
          RecordInfo: { BibEntity: { Identifiers: [{ Type: 'doi', Value: '10.1000/synthetic' }] } },
        }],
        statistics: { TotalHits: 1, TotalSearchTime: 7 },
      },
    });
    const progress = vi.fn();

    const [group] = await searchSyllabusEntries([{ id: 'entry-1', text: 'Test Author. “Synthetic Article.” 2024.' }], progress);

    expect(mocks.searchEDS).toHaveBeenCalledOnce();
    expect(group.results[0]).toMatchObject({
      title: 'Synthetic Article',
      id: 'synthetic-an',
      dbId: 'synthetic-db',
      authors: ['Test Author'],
      doi: '10.1000/synthetic',
    });
    expect(group.totalHits).toBe(1);
    expect(progress).toHaveBeenCalledWith(1, 1);
  });
});
