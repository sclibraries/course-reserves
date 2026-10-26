import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export async function extractSyllabusText(content: ArrayBuffer, mimeType: string): Promise<string> {
  if (mimeType === 'application/pdf') {
    const { getDocument, GlobalWorkerOptions } = await import('pdfjs-dist');
    GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
    const loadingTask = getDocument({ data: new Uint8Array(content.slice(0)) });
    try {
      const document = await loadingTask.promise;
      const pages: string[] = [];
      for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
        const page = await document.getPage(pageNumber);
        const text = await page.getTextContent();
        pages.push(text.items.map((item) => (
          'str' in item ? `${item.str}${item.hasEOL ? '\n' : ' '}` : ''
        )).join('').replace(/[ \t]+\n/g, '\n').trim());
      }
      return pages.join('\n');
    } finally {
      await loadingTask.destroy();
    }
  }

  if (mimeType === DOCX_MIME) {
    const mammoth = await import('mammoth');
    return (await mammoth.default.extractRawText({ arrayBuffer: content })).value;
  }

  throw new Error('Unsupported syllabus type');
}
