import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { fireEvent, getByRole } from '@testing-library/dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CourseReserve } from '@/store/courseReservesStore';
import SubmissionEditorContext, { type SubmissionEditorContextValue } from '@/pages/SubmissionEditor/SubmissionEditorContext';
import { expectNoAxeViolations, expectNoHorizontalOverflow } from '@/test/browser';

vi.mock('@/services/api/facultySyllabusApi', () => ({
  createFacultySyllabus: vi.fn(),
  listFacultySyllabi: vi.fn().mockResolvedValue([{
    id: 1,
    source: 'upload',
    source_url: null,
    original_filename: 'synthetic_syllabus_with_a_long_filename_for_reflow_checks_at_small_viewports.pdf',
    mime_type: 'application/pdf',
    byte_size: 100,
    extracted_text: 'Synthetic reading list',
    created_at: '2026-10-26T12:00:00Z',
  }]),
}));

import SyllabusUploadSection from './SyllabusUploadSection';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const reserve: CourseReserve = {
  id: 'browser-draft', submissionUuid: 'browser-draft', courseCode: 'BIO 101', courseTitle: 'Synthetic Biology',
  section: '01', instructors: 'Test Faculty', term: '2027SP', status: 'draft', items: [], folders: [], layout: [],
  lastUpdated: '2026-10-26',
};
const context = {
  id: reserve.id, reserve, ensureServerUuid: async () => reserve.id, isReadOnly: false,
} as unknown as SubmissionEditorContextValue;

describe('Syllabus upload section in Chromium', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    container = null;
    root = null;
  });

  async function renderSection() {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root?.render(
        <SubmissionEditorContext.Provider value={context}>
          <main className="mx-auto w-full max-w-3xl p-4">
            <SyllabusUploadSection onReviewText={() => undefined} />
          </main>
        </SubmissionEditorContext.Provider>,
      );
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
    expect(container.textContent).toContain('Add a syllabus');
  }

  it('reflows without page overflow at mobile, tablet, and desktop widths', async () => {
    await renderSection();
    const googleDocInput = getByRole(container!, 'textbox', { name: 'Google Docs link' });
    await act(async () => fireEvent.change(googleDocInput, {
      target: { value: `https://docs.google.com/document/d/${'synthetic'.repeat(45)}/edit?usp=sharing` },
    }));
    await expectNoHorizontalOverflow([320, 768, 1280]);
  });

  it('has no axe violations in Chromium', async () => {
    await renderSection();
    await expectNoAxeViolations(container!);
  });
});
