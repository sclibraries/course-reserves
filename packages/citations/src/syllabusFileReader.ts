import {
  extractSyllabusText,
  type SyllabusMammothModule,
  type SyllabusPdfJsModule,
} from './syllabusTextExtractor';

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

export type SyllabusFileErrorCode = 'syllabus_file_too_large' | 'unsupported_syllabus_type';

export interface SyllabusFile {
  name: string;
  type: string;
  size: number;
  arrayBuffer(): Promise<ArrayBuffer>;
}

export interface SyllabusFilePayload {
  filename: string;
  mime_type: string;
  content_base64: string;
  extracted_text: string;
}

export interface SyllabusFileLoaders {
  loadPdfJs: () => Promise<SyllabusPdfJsModule>;
  loadMammoth: () => Promise<SyllabusMammothModule>;
}

export class SyllabusFileError extends Error {
  constructor(public code: SyllabusFileErrorCode) {
    super(code);
    this.name = 'SyllabusFileError';
  }
}

export async function readSyllabusFile(
  file: SyllabusFile,
  loaders: SyllabusFileLoaders,
): Promise<{ text: string; payload: SyllabusFilePayload }> {
  if (file.size > MAX_FILE_BYTES) throw new SyllabusFileError('syllabus_file_too_large');

  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  const mimeType = MIME_BY_EXTENSION[extension];
  if (!mimeType || (file.type && file.type !== mimeType)) throw new SyllabusFileError('unsupported_syllabus_type');

  const content = await file.arrayBuffer();
  const pdfjs = mimeType === 'application/pdf' ? await loaders.loadPdfJs() : undefined;
  const mammoth = mimeType === MIME_BY_EXTENSION.docx ? await loaders.loadMammoth() : undefined;
  const text = await extractSyllabusText(content, mimeType, pdfjs, mammoth);

  return {
    text,
    payload: {
      filename: file.name,
      mime_type: mimeType,
      content_base64: toBase64(content),
      extracted_text: text,
    },
  };
}

function toBase64(content: ArrayBuffer): string {
  const bytes = new Uint8Array(content);
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}
