import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { fireEvent, getByRole, within } from '@testing-library/dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import type { CourseReserve } from '@/store/courseReservesStore';
import SubmissionEditorContext, { type SubmissionEditorContextValue } from '@/pages/SubmissionEditor/SubmissionEditorContext';

const api = vi.hoisted(() => ({ create: vi.fn(), list: vi.fn() }));
vi.mock('@/services/api/facultySyllabusApi', () => ({
  createFacultySyllabus: api.create,
  listFacultySyllabi: api.list,
}));
vi.mock('@/services/syllabusTextExtractor', () => ({ readSyllabusFile: vi.fn() }));

import SyllabusUploadSection from './SyllabusUploadSection';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const record = {
  id: 17, source: 'google_doc' as const, source_url: 'https://docs.google.com/document/d/synthetic/view',
  original_filename: 'syllabus.txt', mime_type: 'text/plain', byte_size: 7,
  extracted_text: 'Week 1\nTest Author (2021). Synthetic citation.', created_at: '2026-10-26T12:00:00Z',
};
const reserve: CourseReserve = {
  id: 'server-draft-1', submissionUuid: 'server-draft-1', courseCode: 'BIO 101', courseTitle: 'Synthetic Biology',
  section: '01', instructors: 'Test Faculty', term: '2027SP', status: 'draft', items: [], folders: [], layout: [],
  lastUpdated: '2026-10-26',
};

async function renderSection(onReviewText = vi.fn()) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const context = {
    id: reserve.id, reserve, ensureServerUuid: vi.fn().mockResolvedValue(reserve.id), isReadOnly: false,
  } as unknown as SubmissionEditorContextValue;
  await act(async () => {
    root.render(
      <SubmissionEditorContext.Provider value={context}>
        <SyllabusUploadSection onReviewText={onReviewText} />
      </SubmissionEditorContext.Provider>,
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  return { container, root, onReviewText };
}

describe('SyllabusUploadSection', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    api.list.mockResolvedValue([record]);
    api.create.mockResolvedValue({ ...record, id: 18 });
  });

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
  });

  it('attaches a Google Doc and reviews an existing syllabus through named controls', async () => {
    const rendered = await renderSection();
    container = rendered.container;
    root = rendered.root;
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
    const region = getByRole(container, 'region', { name: 'Add a syllabus' });
    const input = within(region).getByRole('textbox', { name: 'Google Docs link' }) as HTMLInputElement;
    act(() => fireEvent.change(input, { target: { value: 'https://docs.google.com/document/d/synthetic/view' } }));

    await act(async () => {
      fireEvent.click(within(region).getByRole('button', { name: 'Attach Google Doc' }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(api.create).toHaveBeenCalledWith(reserve.id, {
      google_doc_url: 'https://docs.google.com/document/d/synthetic/view',
    });
    expect(within(region).getAllByText('Google Doc')).toHaveLength(2);
    const reviewButtons = within(region).getAllByRole('button', { name: 'Review citations from Google Doc' });
    await act(async () => fireEvent.click(reviewButtons[reviewButtons.length - 1]));
    expect(rendered.onReviewText).toHaveBeenCalledWith(record.extracted_text);
  });

  it('has no axe accessibility violations', async () => {
    const rendered = await renderSection();
    container = rendered.container;
    root = rendered.root;
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
    const { violations } = await axe(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(violations.map((violation) => violation.id)).toEqual([]);
  });

  it('associates syllabus errors with the link and file controls', async () => {
    api.create.mockRejectedValueOnce({ response: { data: { error_code: 'google_doc_not_shared' } } });
    const rendered = await renderSection();
    container = rendered.container;
    root = rendered.root;
    const region = getByRole(container, 'region', { name: 'Add a syllabus' });
    const input = within(region).getByRole('textbox', { name: 'Google Docs link' });
    act(() => fireEvent.change(input, { target: { value: record.source_url } }));
    await act(async () => {
      fireEvent.click(within(region).getByRole('button', { name: 'Attach Google Doc' }));
      await Promise.resolve();
    });

    const alert = within(region).getByRole('alert');
    expect(input.getAttribute('aria-describedby')).toContain(alert.id);
    expect(within(region).getByLabelText('Upload a PDF or DOCX').getAttribute('aria-describedby')).toContain(alert.id);
  });
});
