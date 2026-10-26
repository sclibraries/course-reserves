import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readSyllabusFile, SyllabusFileError } from './syllabusFileReader';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const bytes = new Uint8Array([0, 1, 254, 255]);

function makeFile(name: string, type: string, size = bytes.length) {
  return {
    name,
    type,
    size,
    arrayBuffer: vi.fn().mockResolvedValue(bytes.buffer),
  };
}

function pdfLoader() {
  const destroy = vi.fn().mockResolvedValue(undefined);
  const module = {
    getDocument: vi.fn().mockReturnValue({
      promise: Promise.resolve({
        numPages: 1,
        getPage: async () => ({ getTextContent: async () => ({ items: [{ str: 'Week 1', hasEOL: true }] }) }),
      }),
      destroy,
    }),
  };
  return { module, destroy };
}

describe('readSyllabusFile', () => {
  let loaders: { loadPdfJs: ReturnType<typeof vi.fn>; loadMammoth: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    loaders = { loadPdfJs: vi.fn(), loadMammoth: vi.fn() };
  });

  it('rejects files over 10 MB before reading bytes or loading a parser', async () => {
    const file = makeFile('synthetic.pdf', 'application/pdf', 10 * 1024 * 1024 + 1);

    await expect(readSyllabusFile(file, loaders)).rejects.toMatchObject({
      name: 'SyllabusFileError', code: 'syllabus_file_too_large',
      message: 'syllabus_file_too_large',
    });
    expect(file.arrayBuffer).not.toHaveBeenCalled();
    expect(loaders.loadPdfJs).not.toHaveBeenCalled();
    expect(loaders.loadMammoth).not.toHaveBeenCalled();
  });

  it.each([
    ['unsupported extension', 'synthetic.txt', 'text/plain'],
    ['extension and MIME mismatch', 'synthetic.pdf', 'text/html'],
  ])('rejects %s before reading bytes', async (_case, name, type) => {
    const file = makeFile(name, type);

    await expect(readSyllabusFile(file, loaders)).rejects.toBeInstanceOf(SyllabusFileError);
    await expect(readSyllabusFile(file, loaders)).rejects.toMatchObject({
      code: 'unsupported_syllabus_type', message: 'unsupported_syllabus_type',
    });
    expect(file.arrayBuffer).not.toHaveBeenCalled();
    expect(loaders.loadPdfJs).not.toHaveBeenCalled();
    expect(loaders.loadMammoth).not.toHaveBeenCalled();
  });

  it('extracts PDF text and returns the upload payload with a base64 round trip', async () => {
    const { module, destroy } = pdfLoader();
    loaders.loadPdfJs.mockResolvedValue(module);
    const file = makeFile('synthetic.pdf', 'application/pdf');

    const result = await readSyllabusFile(file, loaders);

    expect(result).toEqual({
      text: 'Week 1',
      payload: {
        filename: 'synthetic.pdf', mime_type: 'application/pdf', content_base64: 'AAH+/w==', extracted_text: 'Week 1',
      },
    });
    expect(loaders.loadPdfJs).toHaveBeenCalledOnce();
    expect(loaders.loadMammoth).not.toHaveBeenCalled();
    expect(module.getDocument).toHaveBeenCalledOnce();
    expect(destroy).toHaveBeenCalledOnce();
    expect([...new Uint8Array(Uint8Array.from(atob(result.payload.content_base64), (character) => character.charCodeAt(0)).buffer)])
      .toEqual([...bytes]);
  });

  it('extracts DOCX text and uses the shared payload fields', async () => {
    const mammoth = { default: { extractRawText: vi.fn().mockResolvedValue({ value: 'Week 2\nSynthetic reading' }) } };
    loaders.loadMammoth.mockResolvedValue(mammoth);
    const file = makeFile('synthetic.docx', DOCX_MIME);

    const result = await readSyllabusFile(file, loaders);

    expect(result).toEqual({
      text: 'Week 2\nSynthetic reading',
      payload: {
        filename: 'synthetic.docx', mime_type: DOCX_MIME, content_base64: 'AAH+/w==',
        extracted_text: 'Week 2\nSynthetic reading',
      },
    });
    expect(loaders.loadMammoth).toHaveBeenCalledOnce();
    expect(loaders.loadPdfJs).not.toHaveBeenCalled();
    expect(mammoth.default.extractRawText).toHaveBeenCalledWith({ arrayBuffer: bytes.buffer });
  });

  it('accepts files whose browser MIME type is empty when the extension is supported', async () => {
    loaders.loadPdfJs.mockResolvedValue(pdfLoader().module);

    await expect(readSyllabusFile(makeFile('synthetic.pdf', ''), loaders)).resolves.toMatchObject({
      payload: { mime_type: 'application/pdf' },
    });
  });
});
