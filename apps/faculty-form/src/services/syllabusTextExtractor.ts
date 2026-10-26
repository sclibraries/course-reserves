import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { readSyllabusFile as readSharedSyllabusFile, type SyllabusFile } from '@course-reserves/citations';

export function readSyllabusFile(file: SyllabusFile) {
  return readSharedSyllabusFile(file, {
    loadPdfJs: async () => {
      const pdfjs = await import('pdfjs-dist');
      pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
      return pdfjs;
    },
    loadMammoth: () => import('mammoth'),
  });
}
