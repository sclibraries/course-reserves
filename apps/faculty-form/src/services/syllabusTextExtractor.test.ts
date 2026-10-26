import { beforeEach, describe, expect, it, vi } from 'vitest';
import { extractCitationsFromSyllabus } from '@course-reserves/citations';

const pdf = vi.hoisted(() => ({
  getDocument: vi.fn(),
  GlobalWorkerOptions: { workerSrc: '' },
}));
const docx = vi.hoisted(() => ({ extractRawText: vi.fn() }));

vi.mock('pdfjs-dist', () => pdf);
vi.mock('mammoth', () => ({ default: docx }));
vi.mock('pdfjs-dist/build/pdf.worker.min.mjs?url', () => ({ default: '/pdf.worker.mjs' }));

import { extractSyllabusText } from './syllabusTextExtractor';

const bytes = new Uint8Array([1, 2, 3]).buffer;

describe('extractSyllabusText', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pdf.GlobalWorkerOptions.workerSrc = '';
  });

  it('extracts PDF text in page order', async () => {
    pdf.getDocument.mockReturnValue({
      promise: Promise.resolve({
      numPages: 2,
      getPage: vi.fn().mockImplementation(async (pageNumber: number) => ({
        getTextContent: async () => ({ items: [
          { str: `Page ${pageNumber}`, hasEOL: true },
          { str: 'text', hasEOL: false },
        ] }),
      })),
      }),
      destroy: vi.fn(),
    });

    await expect(extractSyllabusText(bytes, 'application/pdf')).resolves.toBe('Page 1\ntext\nPage 2\ntext');
    expect(pdf.getDocument).toHaveBeenCalledWith({ data: new Uint8Array(bytes) });
    expect(pdf.GlobalWorkerOptions.workerSrc).toBe('/pdf.worker.mjs');
  });

  it('preserves the source buffer when PDF.js transfers its input to a worker', async () => {
    const input = new Uint8Array([1, 2, 3]).buffer;
    pdf.getDocument.mockImplementation(({ data }: { data: Uint8Array }) => {
      structuredClone(data.buffer, { transfer: [data.buffer] });
      return { promise: Promise.resolve({ numPages: 0 }), destroy: vi.fn() };
    });

    await extractSyllabusText(input, 'application/pdf');

    expect(input.byteLength).toBe(3);
  });

  it('passes PDF heading and citation lines through the shared citation extractor', async () => {
    pdf.getDocument.mockReturnValue({
      promise: Promise.resolve({
        numPages: 1,
        getPage: async () => ({
          getTextContent: async () => ({ items: [
            { str: 'Week 1', hasEOL: true },
            { str: 'Test Author (2021). Synthetic reading one.', hasEOL: true },
            { str: 'Example Author (2022). Synthetic reading two.', hasEOL: true },
          ] }),
        }),
      }),
      destroy: vi.fn(),
    });

    const text = await extractSyllabusText(bytes, 'application/pdf');

    expect(extractCitationsFromSyllabus(text).entries.map(({ heading }) => heading)).toEqual(['Week 1', 'Week 1']);
  });

  it('destroys the PDF loading task when document loading fails', async () => {
    const destroy = vi.fn().mockResolvedValue(undefined);
    pdf.getDocument.mockReturnValue({
      promise: Promise.resolve().then(() => { throw new Error('PDF parsing failed'); }),
      destroy,
    });

    await expect(extractSyllabusText(bytes, 'application/pdf')).rejects.toThrow('PDF parsing failed');
    expect(destroy).toHaveBeenCalledOnce();
  });

  it('extracts raw DOCX text without converting document HTML', async () => {
    docx.extractRawText.mockResolvedValue({ value: 'Week 1\nSynthetic reading' });

    await expect(extractSyllabusText(bytes, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'))
      .resolves.toBe('Week 1\nSynthetic reading');
    expect(docx.extractRawText).toHaveBeenCalledWith({ arrayBuffer: bytes });
  });

  it('rejects unsupported file types', async () => {
    await expect(extractSyllabusText(bytes, 'text/plain')).rejects.toThrow('Unsupported syllabus type');
  });
});
