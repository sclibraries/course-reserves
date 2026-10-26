import { beforeEach, describe, expect, it, vi } from 'vitest';

const pdf = vi.hoisted(() => ({
  getDocument: vi.fn(),
  GlobalWorkerOptions: { workerSrc: '' },
}));
const docx = vi.hoisted(() => ({ extractRawText: vi.fn() }));

vi.mock('pdfjs-dist', () => pdf);
vi.mock('mammoth', () => ({ default: docx }));
vi.mock('pdfjs-dist/build/pdf.worker.min.mjs?url', () => ({ default: '/pdf.worker.mjs' }));

import { readSyllabusFile } from './syllabusTextExtractor';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const bytes = new Uint8Array([1, 2, 3]).buffer;

function makeFile(name: string, type: string) {
  return Object.assign(new File([bytes], name, { type }), {
    arrayBuffer: vi.fn().mockResolvedValue(bytes),
  });
}

describe('readSyllabusFile app loaders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pdf.GlobalWorkerOptions.workerSrc = '';
  });

  it('loads PDF.js, sets its app worker URL and returns the shared payload', async () => {
    pdf.getDocument.mockReturnValue({
      promise: Promise.resolve({
        numPages: 1,
        getPage: async () => ({ getTextContent: async () => ({ items: [{ str: 'Week 1', hasEOL: true }] }) }),
      }),
      destroy: vi.fn().mockResolvedValue(undefined),
    });

    await expect(readSyllabusFile(makeFile('synthetic.pdf', 'application/pdf'))).resolves.toEqual({
      text: 'Week 1',
      payload: {
        filename: 'synthetic.pdf', mime_type: 'application/pdf', content_base64: 'AQID', extracted_text: 'Week 1',
      },
    });
    expect(pdf.GlobalWorkerOptions.workerSrc).toBe('/pdf.worker.mjs');
    expect(docx.extractRawText).not.toHaveBeenCalled();
  });

  it('loads Mammoth for DOCX files without loading PDF.js', async () => {
    docx.extractRawText.mockResolvedValue({ value: 'Week 2\nSynthetic reading' });

    const result = await readSyllabusFile(makeFile('synthetic.docx', DOCX_MIME));

    expect(result).toEqual({
      text: 'Week 2\nSynthetic reading',
      payload: {
        filename: 'synthetic.docx', mime_type: DOCX_MIME, content_base64: 'AQID',
        extracted_text: 'Week 2\nSynthetic reading',
      },
    });
    expect(docx.extractRawText).toHaveBeenCalledWith({ arrayBuffer: bytes });
    expect(pdf.getDocument).not.toHaveBeenCalled();
  });
});
