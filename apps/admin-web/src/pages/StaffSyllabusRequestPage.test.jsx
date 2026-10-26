import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { fireEvent, screen, within } from '@testing-library/dom';
import { axe } from 'vitest-axe';
import { toHaveNoViolations } from 'vitest-axe/matchers';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import StaffSyllabusRequestPage from './StaffSyllabusRequestPage';

expect.extend({ toHaveNoViolations });

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

const googleDocUrl = 'https://docs.google.com/document/d/synthetic-syllabus/edit';
const syllabusText = `The Architecture of Memory
Synthetic Author, “A Sample Journal Article,” Example Journal 11 (2020): 1–8.
Sample Author, “A Chapter about Test Collections.” In Example Editors ed., Sample Reader (Example City: Test Press, 2018), pp. 40–58.
Synthetic Web Resource Guide [https://example.test/guide]
Film: Sample Film Alpha - a synthetic class note [https://example.test/alpha]
Stories and Oral Tradition
Demo Author, “A Synthetic Oral Tradition Article,” Example Review 7 (2022): 3–12.`;
const entryOne = 'Synthetic Author, “A Sample Journal Article,” Example Journal 11 (2020): 1–8.';
const entryTwo = 'Sample Author, “A Chapter about Test Collections.” In Example Editors ed., Sample Reader (Example City: Test Press, 2018), pp. 40–58.';
const entryThree = 'Synthetic Web Resource Guide';
const entryFour = 'Sample Film Alpha';
const entryFive = 'Demo Author, “A Synthetic Oral Tradition Article,” Example Review 7 (2022): 3–12.';

const result = (id, title) => ({
  id,
  dbId: 'synthetic-database',
  title,
  authors: ['Synthetic Author'],
  publicationType: 'Academic Journal',
  publicationInfo: 'Synthetic Journal',
  publicationDate: { year: '2024' },
  issn: '1234-5678',
  journalTitle: 'Synthetic Journal',
  volumeNumber: '11',
  issueNumber: '1',
  pLink: `https://example.test/records/${id}`,
});

const course = {
  name: 'Synthetic Literature',
  courseNumber: 'ENG 101',
  sectionName: '01',
  courseListingId: 'listing-21',
  courseListingObject: {
    termObject: { name: 'Fall 2026' },
    instructorObjects: [{ name: 'Synthetic Faculty One' }, { name: 'Synthetic Faculty Two' }],
  },
};

function createGroups(entries, onProgress) {
  onProgress(entries.length, entries.length);
  return Promise.resolve(entries.map((entry, index) => ({
    id: entry.id,
    results: index === 0
      ? [result('record-best', 'A Sample Journal Article'), result('record-other', 'Different Synthetic Article')]
      : index === 1
        ? [result('record-chapter', 'A Chapter about Test Collections'), result('record-alternative', 'Alternate Chapter Record')]
        : [],
    totalHits: index < 2 ? 2 : 0,
  })));
}

async function click(element) {
  await act(async () => fireEvent.click(element));
}

async function change(element, value) {
  await act(async () => fireEvent.change(element, { target: { value } }));
}

let container;
let root;

async function renderPage() {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root.render(
    <MemoryRouter initialEntries={['/admin/electronic/listing-21/syllabus-request']}>
      <Routes>
        <Route path="/admin/electronic/:folioCourseId/syllabus-request" element={<StaffSyllabusRequestPage />} />
        <Route path="/admin/submissions/:submissionId" element={<p>Submission detail route reached</p>} />
      </Routes>
    </MemoryRouter>,
  ));
  await screen.findByRole('heading', { name: 'Start a request from a syllabus' });
}

async function startGoogleDocReview() {
  await change(screen.getByRole('textbox', { name: 'Google Doc URL' }), googleDocUrl);
  await click(screen.getByRole('button', { name: 'Extract and find matches' }));
  await screen.findByRole('heading', { name: 'Review matched items' });
}

async function keepAllAsTyped() {
  const entryGroups = screen.getAllByRole('group', { name: /^(?:Synthetic Author|Sample Author|Synthetic Web Resource Guide|Sample Film Alpha|Demo Author)/ });
  for (const entryGroup of entryGroups) {
    await click(within(entryGroup).getByRole('button', { name: 'Keep as typed' }));
  }
}

async function fillInstructor() {
  await change(screen.getByRole('textbox', { name: 'Instructor name' }), 'Synthetic Faculty One');
  await change(screen.getByRole('textbox', { name: 'Smith username' }), 'syntheticfaculty');
}

beforeEach(() => {
  mocks.fetchCourseData.mockReset().mockResolvedValue([course]);
  mocks.getGoogleDocText.mockReset().mockResolvedValue(syllabusText);
  mocks.readSyllabusFile.mockReset().mockResolvedValue({
    text: syllabusText,
    payload: {
      filename: 'synthetic.pdf',
      mime_type: 'application/pdf',
      content_base64: 'c3ludGhldGlj',
      extracted_text: syllabusText,
    },
  });
  mocks.searchSyllabusEntries.mockReset().mockImplementation(createGroups);
  mocks.createStaffSyllabusSubmission.mockReset().mockResolvedValue({ submission_id: 42, submission_uuid: 'synthetic-submission-42' });
});

afterEach(() => {
  if (root) act(() => root.unmount());
  container?.remove();
  root = null;
  container = null;
  document.body.innerHTML = '';
});

describe('StaffSyllabusRequestPage', () => {
  it('reads a Google Doc, groups entries, reviews each choice, and submits the exact API-098 body', async () => {
    await renderPage();
    await startGoogleDocReview();

    expect(mocks.fetchCourseData).toHaveBeenCalledWith('listing-21');
    expect(mocks.getGoogleDocText).toHaveBeenCalledWith(googleDocUrl);
    expect(screen.getByRole('heading', { name: 'The Architecture of Memory' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Stories and Oral Tradition' })).toBeTruthy();

    const firstEntry = screen.getByRole('group', { name: entryOne });
    await click(within(firstEntry).getByRole('button', { name: 'Accept suggested match' }));
    const secondEntry = screen.getByRole('group', { name: entryTwo });
    await click(within(secondEntry).getByRole('button', { name: 'Choose match: Alternate Chapter Record' }));
    await click(within(screen.getByRole('group', { name: entryThree })).getByRole('button', { name: 'Keep as typed' }));
    await click(within(screen.getByRole('group', { name: entryFour })).getByRole('button', { name: 'Drop entry' }));
    await click(within(screen.getByRole('group', { name: entryFive })).getByRole('button', { name: 'Keep as typed' }));

    const username = screen.getByRole('textbox', { name: 'Smith username' });
    expect(username.required).toBe(true);
    expect(screen.getByText('Enter the instructor’s Smith username, the part before @smith.edu.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Create request' }).disabled).toBe(true);
    await change(screen.getByRole('textbox', { name: 'Instructor name' }), 'Synthetic Faculty One');
    await change(username, 'syntheticfaculty');
    await click(screen.getByRole('button', { name: 'Create request' }));

    const expectedBody = {
      folio_course_listing_id: 'listing-21',
      instructor_username: 'syntheticfaculty',
      instructor_display_name: 'Synthetic Faculty One',
      courseInfo: {
        courseCode: 'ENG 101',
        courseTitle: 'Synthetic Literature',
        section: '01',
        term: 'Fall 2026',
      },
      folders: [
        { id: 'syllabus-folder-1', title: 'The Architecture of Memory', display_order: 0 },
        { id: 'syllabus-folder-2', title: 'Stories and Oral Tradition', display_order: 1 },
      ],
      items: [
        {
          resource_data: {
            title: 'A Sample Journal Article',
            authors: 'Synthetic Author',
            issn: '1234-5678',
            journalTitle: 'Synthetic Journal',
            volume: '11',
            issue: '1',
            publicationYear: '2024',
            publisher: 'Synthetic Journal',
            eds: { dbId: 'synthetic-database', an: 'record-best', plink: 'https://example.test/records/record-best' },
            url: 'https://example.test/records/record-best',
            materialType: 'article',
            status: 'draft',
            notes: entryOne,
          },
          folder_uuid: 'syllabus-folder-1',
          display_order: 0,
        },
        {
          resource_data: {
            title: 'Alternate Chapter Record',
            authors: 'Synthetic Author',
            issn: '1234-5678',
            journalTitle: 'Synthetic Journal',
            volume: '11',
            issue: '1',
            publicationYear: '2024',
            publisher: 'Synthetic Journal',
            eds: { dbId: 'synthetic-database', an: 'record-alternative', plink: 'https://example.test/records/record-alternative' },
            url: 'https://example.test/records/record-alternative',
            materialType: 'article',
            status: 'draft',
            notes: entryTwo,
          },
          folder_uuid: 'syllabus-folder-1',
          display_order: 1,
        },
        {
          resource_data: {
            title: 'Synthetic Web Resource Guide',
            materialType: 'website',
            status: 'draft',
            notes: entryThree,
            url: 'https://example.test/guide',
          },
          folder_uuid: 'syllabus-folder-1',
          display_order: 2,
        },
        {
          resource_data: {
            title: entryFive,
            materialType: 'book',
            status: 'draft',
            notes: entryFive,
          },
          folder_uuid: 'syllabus-folder-2',
          display_order: 3,
        },
      ],
      syllabus: { google_doc_url: googleDocUrl },
    };
    await screen.findByRole('link', { name: 'Open staff submission' });
    expect(JSON.parse(JSON.stringify(mocks.createStaffSyllabusSubmission.mock.calls[0][0]))).toEqual(expectedBody);
    expect(screen.getByRole('link', { name: 'Open staff submission' }).getAttribute('href')).toBe('/admin/submissions/42');
    await click(screen.getByRole('link', { name: 'Open staff submission' }));
    expect(container.textContent).toContain('Submission detail route reached');
  });

  it.each([
    ['PDF', 'synthetic.pdf', 'application/pdf'],
    ['DOCX', 'synthetic.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  ])('reads a %s upload and searches its entries', async (_label, filename, mimeType) => {
    await renderPage();
    await click(screen.getByRole('button', { name: 'Upload PDF or DOCX' }));
    const uploaded = new File(['synthetic file'], filename, { type: mimeType });
    await act(async () => fireEvent.change(screen.getByLabelText('PDF or DOCX file'), {
      target: { files: [uploaded] },
    }));
    await click(screen.getByRole('button', { name: 'Extract and find matches' }));

    await screen.findByRole('heading', { name: 'Review matched items' });
    expect(mocks.readSyllabusFile).toHaveBeenCalledWith(uploaded);
    expect(mocks.searchSyllabusEntries).toHaveBeenCalled();
  });

  it('shows the familiar file type error when the shared reader rejects an unsupported file', async () => {
    await renderPage();
    await click(screen.getByRole('button', { name: 'Upload PDF or DOCX' }));
    mocks.readSyllabusFile.mockRejectedValueOnce(Object.assign(new Error('unsupported_syllabus_type'), {
      code: 'unsupported_syllabus_type',
    }));
    const uploaded = new File(['synthetic file'], 'synthetic.txt', { type: 'text/plain' });
    await act(async () => fireEvent.change(screen.getByLabelText('PDF or DOCX file'), {
      target: { files: [uploaded] },
    }));
    await click(screen.getByRole('button', { name: 'Extract and find matches' }));

    expect((await screen.findByRole('alert')).textContent).toContain('Choose a PDF or DOCX file.');
    expect(mocks.searchSyllabusEntries).not.toHaveBeenCalled();
  });

  it('keeps the Smith username required and announces the hint accessibly', async () => {
    await renderPage();
    await startGoogleDocReview();
    await keepAllAsTyped();

    const username = screen.getByRole('textbox', { name: 'Smith username' });
    expect(username.required).toBe(true);
    expect(username.getAttribute('aria-describedby')).toBe('smith-username-hint');
    expect(screen.getByRole('button', { name: 'Create request' }).disabled).toBe(true);
  });

  it('requires at least one kept entry before creating a request', async () => {
    await renderPage();
    await startGoogleDocReview();
    const entryGroups = screen.getAllByRole('group', { name: /^(?:Synthetic Author|Sample Author|Synthetic Web Resource Guide|Sample Film Alpha|Demo Author)/ });
    for (const entryGroup of entryGroups) {
      await click(within(entryGroup).getByRole('button', { name: 'Drop entry' }));
    }
    await fillInstructor();

    expect(screen.getByText('Keep at least one syllabus entry to create a request.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Create request' }).disabled).toBe(true);
  });

  it('explains when the instructor already has a draft', async () => {
    mocks.createStaffSyllabusSubmission.mockRejectedValueOnce({ payload: { error_code: 'instructor_draft_exists' } });
    await renderPage();
    await startGoogleDocReview();
    await keepAllAsTyped();
    await fillInstructor();
    await click(screen.getByRole('button', { name: 'Create request' }));

    expect((await screen.findByRole('alert')).textContent)
      .toContain('This instructor already has a draft for this course; ask them to submit it, or add these items to it');
  });

  it('shows a generic create error with its reference', async () => {
    mocks.createStaffSyllabusSubmission.mockRejectedValueOnce({
      payload: { error_code: 'request_failed', reference_id: 'SYNTH-500' },
    });
    await renderPage();
    await startGoogleDocReview();
    await keepAllAsTyped();
    await fillInstructor();
    await click(screen.getByRole('button', { name: 'Create request' }));

    expect((await screen.findByRole('alert')).textContent).toContain('Reference: SYNTH-500');
  });

  it('keeps the initial page accessible', async () => {
    await renderPage();
    expect(await axe(container)).toHaveNoViolations();
  });
});
