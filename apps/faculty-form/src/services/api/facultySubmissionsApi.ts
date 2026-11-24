import { API_ENDPOINTS } from '@/config/endpoints';
import type { BackendSubmission } from '@/store/reserve/submissionMapping';

type IndexPage = {
  items: BackendSubmission[];
  meta: { totalCount: number };
};

const PAGE_SIZE = 50;

export const readAllSubmissions = async (
  readPage: (url: string) => Promise<IndexPage>,
): Promise<BackendSubmission[]> => {
  const indexUrl = `${API_ENDPOINTS.COURSE_RESERVES.BASE_URL}${API_ENDPOINTS.COURSE_RESERVES.FACULTY_SUBMISSION_INDEX}`;
  const firstPage = await readPage(`${indexUrl}?per-page=${PAGE_SIZE}&page=1`);
  const submissions = new Map(firstPage.items.map((submission) => [submission.submission_uuid, submission]));

  for (let page = 2; page <= Math.ceil(firstPage.meta.totalCount / PAGE_SIZE); page += 1) {
    const nextPage = await readPage(`${indexUrl}?per-page=${PAGE_SIZE}&page=${page}`);
    nextPage.items.forEach((submission) => submissions.set(submission.submission_uuid, submission));
  }

  return [...submissions.values()];
};
