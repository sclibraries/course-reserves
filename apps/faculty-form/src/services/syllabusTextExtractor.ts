import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { extractSyllabusText as extractSharedSyllabusText } from '@course-reserves/citations';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export async function extractSyllabusText(content: ArrayBuffer, mimeType: string): Promise<string> {
  const pdfjs = mimeType === 'application/pdf' ? await import('pdfjs-dist') : undefined;
  const mammoth = mimeType === DOCX_MIME ? await import('mammoth') : undefined;
  if (pdfjs) {
    pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  }
  return extractSharedSyllabusText(content, mimeType, pdfjs, mammoth);
}
