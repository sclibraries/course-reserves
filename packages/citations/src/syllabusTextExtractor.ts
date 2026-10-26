const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

interface PdfTextItem {
  str?: string;
  hasEOL?: boolean;
}

export interface SyllabusPdfJsModule {
  getDocument(options: { data: Uint8Array }): {
    promise: Promise<{
      numPages: number;
      getPage(pageNumber: number): Promise<{
        getTextContent(): Promise<{ items: PdfTextItem[] }>;
      }>;
    }>;
    destroy(): Promise<void>;
  };
}

export interface SyllabusMammothModule {
  default: {
    extractRawText(options: { arrayBuffer: ArrayBuffer }): Promise<{ value: string }>;
  };
}

export async function extractSyllabusText(
  content: ArrayBuffer,
  mimeType: string,
  pdfjs?: SyllabusPdfJsModule,
  mammoth?: SyllabusMammothModule,
): Promise<string> {
  if (mimeType === 'application/pdf' && pdfjs) {
    const loadingTask = pdfjs.getDocument({ data: new Uint8Array(content.slice(0)) });
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

  if (mimeType === DOCX_MIME && mammoth) {
    return (await mammoth.default.extractRawText({ arrayBuffer: content })).value;
  }

  throw new Error('Unsupported syllabus type');
}
