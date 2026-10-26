import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent } from '@testing-library/dom';
import { page } from '@vitest/browser/context';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import StaffSyllabusRequestPage from './StaffSyllabusRequestPage';
import { expectNoAxeViolations, expectNoHorizontalOverflow } from '../test/browser';
import '../index.css';

const mocks = vi.hoisted(() => ({
  fetchCourseData: vi.fn(),
  getGoogleDocText: vi.fn(),
  readSyllabusFile: vi.fn(),
  searchSyllabusEntries: vi.fn(),
  createStaffSyllabusSubmission: vi.fn(),
}));

vi.mock('../components/page-sections/course-record/api', () => ({ fetchCourseData: mocks.fetchCourseData }));
vi.mock('../services/admin/staffSyllabusRequestService', () => ({
  getGoogleDocText: mocks.getGoogleDocText,
  readSyllabusFile: mocks.readSyllabusFile,
  searchSyllabusEntries: mocks.searchSyllabusEntries,
  createStaffSyllabusSubmission: mocks.createStaffSyllabusSubmission,
}));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const longTitle = `Synthetic syllabus reading ${'extended descriptive wording '.repeat(10)}${'unbroken'.repeat(24)}`;
const syllabus = `Week 1\nSynthetic Author, “${longTitle},” Example Journal 4 (2024): 1–8.`;
const course = {
  name: 'Synthetic Literature',
  courseNumber: 'ENG 101',
  courseListingId: 'listing-21',
  courseListingObject: { termObject: { name: 'Fall 2026' }, instructorObjects: [{ name: 'Synthetic Faculty' }] },
};

let container;
let root;

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

describe('StaffSyllabusRequestPage in Chromium', () => {
  it('reflows long syllabus entries and has no WCAG 2.2 AA violations', async () => {
    mocks.fetchCourseData.mockResolvedValue([course]);
    mocks.getGoogleDocText.mockResolvedValue(syllabus);
    mocks.searchSyllabusEntries.mockImplementation(async (entries) => entries.map((entry) => ({
      id: entry.id,
      results: [{
        id: 'synthetic-result', dbId: 'synthetic-db', title: longTitle, authors: ['Synthetic Author'],
        publicationType: 'Academic Journal', pLink: `https://example.test/${'catalog'.repeat(35)}`,
      }],
      totalHits: 1,
    })));

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root.render(
      <MemoryRouter initialEntries={['/admin/electronic/listing-21/syllabus-request']}>
        <Routes>
          <Route path="/admin/electronic/:folioCourseId/syllabus-request" element={<StaffSyllabusRequestPage />} />
        </Routes>
      </MemoryRouter>,
    ));
    const url = container.querySelector('#google-doc-url');
    await act(async () => fireEvent.change(url, { target: { value: 'https://docs.google.com/document/d/synthetic/edit' } }));
    const extractButton = [...container.querySelectorAll('button')].find((button) => button.textContent.includes('Extract and find matches'));
    await act(async () => fireEvent.click(extractButton));

    expect(container.textContent).toContain(longTitle);
    const widths = [];
    for (const width of [320, 768, 1280]) {
      await page.viewport(width, 900);
      widths.push({ innerWidth: window.innerWidth, scrollWidth: document.documentElement.scrollWidth });
    }
    expect(widths.every(({ innerWidth, scrollWidth }) => scrollWidth <= innerWidth)).toBe(true);
    await expectNoHorizontalOverflow();
    await expectNoAxeViolations();
  });
});
