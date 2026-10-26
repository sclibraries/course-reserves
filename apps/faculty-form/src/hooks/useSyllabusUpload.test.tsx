import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, getByLabelText, getByRole } from '@testing-library/dom';

const api = vi.hoisted(() => ({ create: vi.fn(), list: vi.fn() }));
const extract = vi.hoisted(() => ({ extractSyllabusText: vi.fn() }));

vi.mock('@/services/api/facultySyllabusApi', () => ({
  createFacultySyllabus: api.create,
  listFacultySyllabi: api.list,
}));
vi.mock('@/services/syllabusTextExtractor', () => extract);

import { useSyllabusUpload } from './useSyllabusUpload';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function Harness({
  ensureServerUuid = vi.fn().mockResolvedValue('server-draft-1'),
  onReview = vi.fn(),
  submissionUuid,
}: {
  ensureServerUuid?: () => Promise<string | undefined>;
  onReview?: (text: string) => void;
  submissionUuid?: string;
}) {
  const upload = useSyllabusUpload({
    reserveId: 'reserve-local', submissionUuid, ensureServerUuid, onReview,
  });
  return (
    <div>
      <button onClick={() => void upload.attachGoogleDoc('https://docs.google.com/document/d/synthetic/view')}>
        Attach Google Doc
      </button>
      <label>
        Syllabus file
        <input type="file" onChange={(event) => void upload.attachFile(event.currentTarget.files?.[0])} />
      </label>
      <div role="status">{upload.isReading ? 'Reading your syllabus…' : ''}</div>
      {upload.error && <div role="alert">{upload.error}</div>}
      <ul>{upload.syllabi.map((syllabus) => <li key={syllabus.id}>{syllabus.original_filename}</li>)}</ul>
    </div>
  );
}

const record = {
  id: 1, source: 'upload' as const, source_url: null, original_filename: 'sample.pdf',
  mime_type: 'application/pdf', byte_size: 3, extracted_text: 'Week 1', created_at: '2026-10-26T12:00:00Z',
};

function makeFile(name: string, mimeType: string, size = 3) {
  const file = new File([new Uint8Array(Math.min(size, 3))], name, { type: mimeType });
  Object.defineProperty(file, 'size', { value: size });
  Object.defineProperty(file, 'arrayBuffer', { value: async () => new Uint8Array([1, 2, 3]).buffer });
  return file;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((finish) => { resolve = finish; });
  return { promise, resolve };
}

describe('useSyllabusUpload', () => {
  let container: HTMLDivElement;
  let root: Root;
  let events: string[];
  let ensureServerUuid: ReturnType<typeof vi.fn>;
  let onReview: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    events = [];
    ensureServerUuid = vi.fn(async () => { events.push('save'); return 'server-draft-1'; });
    onReview = vi.fn();
    api.list.mockResolvedValue([]);
    api.create.mockImplementation(async (_uuid, payload) => {
      events.push('attach');
      return { ...record, original_filename: 'google_doc_url' in payload ? 'Google Doc' : payload.filename };
    });
    extract.extractSyllabusText.mockResolvedValue('Week 1');
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root.render(<Harness ensureServerUuid={ensureServerUuid} onReview={onReview} />));
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('saves a UUID-less draft before attaching a Google Doc and reviews returned text', async () => {
    await act(async () => {
      fireEvent.click(getByRole(container, 'button', { name: 'Attach Google Doc' }));
    });

    expect(events).toEqual(['save', 'attach']);
    expect(api.create).toHaveBeenCalledWith('server-draft-1', {
      google_doc_url: 'https://docs.google.com/document/d/synthetic/view',
    });
    expect(onReview).toHaveBeenCalledWith('Week 1');
  });

  it('extracts and attaches a PDF as JSON after a draft UUID exists', async () => {
    const input = getByLabelText(container, 'Syllabus file') as HTMLInputElement;
    const file = makeFile('sample.pdf', 'application/pdf');
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    await act(async () => fireEvent.change(input, { target: { files: [file] } }));

    expect(extract.extractSyllabusText).toHaveBeenCalledWith(expect.any(ArrayBuffer), 'application/pdf');
    expect(api.create).toHaveBeenCalledWith('server-draft-1', {
      filename: 'sample.pdf', mime_type: 'application/pdf', content_base64: 'AQID', extracted_text: 'Week 1',
    });
    expect(onReview).toHaveBeenCalledWith('Week 1');
  });

  it('extracts and attaches a DOCX', async () => {
    const input = getByLabelText(container, 'Syllabus file') as HTMLInputElement;
    const file = makeFile('sample.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    await act(async () => fireEvent.change(input, { target: { files: [file] } }));

    expect(extract.extractSyllabusText).toHaveBeenCalledWith(expect.any(ArrayBuffer), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    expect(api.create).toHaveBeenCalledWith('server-draft-1', expect.objectContaining({
      filename: 'sample.docx', mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      content_base64: 'AQID', extracted_text: 'Week 1',
    }));
  });

  it('gives Google Docs sharing steps for an unshared document without showing raw API errors', async () => {
    api.create.mockRejectedValueOnce({
      response: { data: { error_code: 'google_doc_not_shared', reference_id: 'ref-synthetic', error: 'private details' } },
    });
    await act(async () => {
      fireEvent.click(getByRole(container, 'button', { name: 'Attach Google Doc' }));
    });

    const alert = getByRole(container, 'alert');
    expect(alert?.textContent).toContain('Anyone with the link');
    expect(alert?.textContent).toContain('ref-synthetic');
    expect(alert?.textContent).not.toContain('private details');
    expect(onReview).not.toHaveBeenCalled();
  });

  it('rejects oversized files before creating a server draft', async () => {
    const input = getByLabelText(container, 'Syllabus file') as HTMLInputElement;
    const file = makeFile('sample.pdf', 'application/pdf', 10 * 1024 * 1024 + 1);
    await act(async () => fireEvent.change(input, { target: { files: [file] } }));

    expect(getByRole(container, 'alert').textContent).toContain('10 MB limit');
    expect(ensureServerUuid).not.toHaveBeenCalled();
    expect(api.create).not.toHaveBeenCalled();
  });

  it('rejects unsupported files before creating a server draft', async () => {
    const input = getByLabelText(container, 'Syllabus file') as HTMLInputElement;
    const file = makeFile('sample.txt', 'text/plain');
    await act(async () => fireEvent.change(input, { target: { files: [file] } }));

    expect(getByRole(container, 'alert').textContent).toContain('PDF or DOCX');
    expect(ensureServerUuid).not.toHaveBeenCalled();
    expect(api.create).not.toHaveBeenCalled();
  });

  it('loads attached syllabi for an existing server UUID', async () => {
    api.list.mockResolvedValue([record]);
    act(() => root.render(<Harness submissionUuid="server-draft-1" ensureServerUuid={ensureServerUuid} onReview={onReview} />));
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });

    expect(api.list).toHaveBeenCalledWith('server-draft-1');
    expect(container.textContent).toContain('sample.pdf');
  });

  it('keeps a newly attached syllabus when an earlier empty GET resolves afterward', async () => {
    const pendingList = deferred<typeof record[]>();
    const pendingCreate = deferred<typeof record>();
    api.list.mockReturnValue(pendingList.promise);
    api.create.mockReturnValue(pendingCreate.promise);

    await act(async () => {
      fireEvent.click(getByRole(container, 'button', { name: 'Attach Google Doc' }));
      await Promise.resolve();
    });
    act(() => root.render(
      <Harness submissionUuid="server-draft-1" ensureServerUuid={ensureServerUuid} onReview={onReview} />,
    ));

    await act(async () => { pendingCreate.resolve(record); await pendingCreate.promise; });
    await act(async () => { pendingList.resolve([]); await pendingList.promise; });

    expect(container.querySelectorAll('li')).toHaveLength(1);
    expect(container.textContent).toContain('sample.pdf');
  });

  it('does not duplicate a syllabus when GET includes it before POST completes', async () => {
    const pendingList = deferred<typeof record[]>();
    const pendingCreate = deferred<typeof record>();
    api.list.mockReturnValue(pendingList.promise);
    api.create.mockReturnValue(pendingCreate.promise);

    act(() => root.render(
      <Harness submissionUuid="server-draft-1" ensureServerUuid={ensureServerUuid} onReview={onReview} />,
    ));
    await act(async () => {
      fireEvent.click(getByRole(container, 'button', { name: 'Attach Google Doc' }));
      await Promise.resolve();
    });
    await act(async () => { pendingList.resolve([record]); await pendingList.promise; });
    await act(async () => { pendingCreate.resolve(record); await pendingCreate.promise; });

    expect(container.querySelectorAll('li')).toHaveLength(1);
  });
});
