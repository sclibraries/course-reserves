import { describe, expect, it, vi } from 'vitest';
import { extractSyllabusText } from './syllabusTextExtractor';

const bytes = new Uint8Array([1, 2, 3]).buffer;

describe('extractSyllabusText', () => {
  it('extracts PDF text in page order and destroys the loading task', async () => {
    const destroy = vi.fn().mockResolvedValue(undefined);
    const pdfjs = {
      getDocument: vi.fn().mockReturnValue({
        promise: Promise.resolve({
          numPages: 2,
          getPage: async (pageNumber: number) => ({
            getTextContent: async () => ({ items: [
              { str: `Page ${pageNumber}`, hasEOL: true },
              { str: 'text', hasEOL: false },
            ] }),
          }),
        }),
        destroy,
      }),
    };

    await expect(extractSyllabusText(bytes, 'application/pdf', pdfjs, {}))
      .resolves.toBe('Page 1\ntext\nPage 2\ntext');
    expect(pdfjs.getDocument).toHaveBeenCalledWith({ data: new Uint8Array(bytes) });
    expect(destroy).toHaveBeenCalledOnce();
  });

  it('preserves the source buffer when PDF.js transfers its input', async () => {
    const pdfjs = {
      getDocument: vi.fn().mockImplementation(({ data }: { data: Uint8Array }) => {
        structuredClone(data.buffer, { transfer: [data.buffer] });
        return { promise: Promise.resolve({ numPages: 0 }), destroy: vi.fn() };
      }),
    };

    await extractSyllabusText(bytes, 'application/pdf', pdfjs, {});

    expect(bytes.byteLength).toBe(3);
  });

  it('extracts raw DOCX text through the supplied mammoth module', async () => {
    const mammoth = { default: { extractRawText: vi.fn().mockResolvedValue({ value: 'Week 1\nReading' }) } };

    await expect(extractSyllabusText(bytes, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', {}, mammoth))
      .resolves.toBe('Week 1\nReading');
    expect(mammoth.default.extractRawText).toHaveBeenCalledWith({ arrayBuffer: bytes });
  });

  it('destroys the PDF loading task when document parsing fails', async () => {
    const destroy = vi.fn().mockResolvedValue(undefined);
    const pdfjs = {
      getDocument: vi.fn().mockReturnValue({
        promise: Promise.reject(new Error('PDF parsing failed')),
        destroy,
      }),
    };

    await expect(extractSyllabusText(bytes, 'application/pdf', pdfjs, {})).rejects.toThrow('PDF parsing failed');
    expect(destroy).toHaveBeenCalledOnce();
  });

  it('rejects unsupported syllabus types', async () => {
    await expect(extractSyllabusText(bytes, 'text/plain', {}, {})).rejects.toThrow('Unsupported syllabus type');
  });
});
