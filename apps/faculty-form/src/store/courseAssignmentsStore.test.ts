import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CourseAssignment } from './courseAssignmentsStore';
import type { useCourseAssignmentsStore as CourseAssignmentsStore } from './courseAssignmentsStore';

const BASE_API_URL = 'https://faculty-api.example.test';
const COURSE_RESERVES_PATH = '/course-reserves/test-web';
const ACCESS_TOKEN = 'synthetic-faculty-token';
const COURSE_ASSIGNMENTS_PATH = '/course-assignments/instructor-courses';

const course: CourseAssignment = {
  assignment: {
    academic_period: 'Fall 2026',
    course_id: 'BIO-101-01',
    course_title: 'Introduction to Biology',
    smith_id: 'faculty-id',
    role: 'instructor',
    created_at: '2026-07-21T00:00:00Z',
    updated_at: '2026-07-21T00:00:00Z',
  },
  parsed_course: {
    courseNumber: 'BIO 101',
    sectionName: '01',
    raw: 'BIO 101-01',
  },
  folio_term: {
    id: 'term-1',
    name: 'Fall 2026',
    startDate: '2026-09-01',
    endDate: '2026-12-20',
  },
  folio_course: {
    id: 'course-1',
    name: 'Introduction to Biology',
  },
};

let apiClient: typeof import('@/services/apiClient').default;
let useCourseAssignmentsStore: typeof CourseAssignmentsStore;
let adapterCalls: number;
let capturedConfig: InternalAxiosRequestConfig | undefined;
let responseData: { success: boolean; courses: CourseAssignment[]; can_edit?: boolean };
let adapterError: Error | null;
let originalAdapter: ReturnType<typeof import('axios').default.create>['defaults']['adapter'];

describe('courseAssignmentsStore', () => {
  beforeAll(async () => {
    let storage: Record<string, string> = {};
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage[key] ?? null,
      setItem: (key: string, value: string) => {
        storage[key] = value;
      },
      removeItem: (key: string) => {
        delete storage[key];
      },
      clear: () => {
        storage = {};
      },
    });
    vi.stubEnv('VITE_BASE_API_URL', BASE_API_URL);
    vi.stubEnv('VITE_COURSE_RESERVES_PATH', COURSE_RESERVES_PATH);
    vi.resetModules();
    ({ default: apiClient } = await import('@/services/apiClient'));
    ({ useCourseAssignmentsStore } = await import('./courseAssignmentsStore'));
    originalAdapter = apiClient.defaults.adapter;
  });

  afterAll(() => {
    if (apiClient) apiClient.defaults.adapter = originalAdapter;
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    adapterCalls = 0;
    capturedConfig = undefined;
    responseData = { success: true, courses: [course] };
    adapterError = null;
    document.cookie = `accessToken=${encodeURIComponent(ACCESS_TOKEN)}; Path=/`;
    apiClient.defaults.adapter = (async (config) => {
      adapterCalls += 1;
      capturedConfig = config;
      if (adapterError) throw adapterError;
      return {
        data: responseData,
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      };
    }) as AxiosAdapter;
    useCourseAssignmentsStore.setState({
      assignments: [],
      loading: false,
      error: null,
      actingForAssignments: [],
      actingForLoading: false,
      actingForError: null,
      actingForCanEdit: null,
    });
  });

  it('requests authenticated instructor courses at the configured backend path without identity query parameters', async () => {
    await useCourseAssignmentsStore.getState().fetchCourseAssignments();

    expect(adapterCalls).toBe(1);
    expect(capturedConfig).toBeDefined();
    const requestUrl = new URL(apiClient.getUri(capturedConfig));
    expect(requestUrl.href).toBe(
      `${BASE_API_URL}${COURSE_RESERVES_PATH}${COURSE_ASSIGNMENTS_PATH}`,
    );
    expect(capturedConfig?.headers.get('Authorization')).toBe(`Bearer ${ACCESS_TOKEN}`);
    expect([...requestUrl.searchParams.keys()]).toEqual([]);
    expect(useCourseAssignmentsStore.getState()).toMatchObject({
      assignments: [course],
      loading: false,
      error: null,
    });
  });

  it('treats an empty course list as a successful deterministic result', async () => {
    useCourseAssignmentsStore.setState({
      assignments: [course],
      error: 'stale error',
    });
    responseData = { success: true, courses: [] };

    await useCourseAssignmentsStore.getState().fetchCourseAssignments();

    expect(adapterCalls).toBe(1);
    expect(useCourseAssignmentsStore.getState()).toMatchObject({
      assignments: [],
      loading: false,
      error: null,
    });
  });

  it('clears assignments, records a readable backend error, and rethrows it', async () => {
    const backendError = new Error('Course service unavailable');
    useCourseAssignmentsStore.setState({ assignments: [course] });
    adapterError = backendError;

    await expect(
      useCourseAssignmentsStore.getState().fetchCourseAssignments(),
    ).rejects.toBe(backendError);

    expect(adapterCalls).toBe(1);
    expect(useCourseAssignmentsStore.getState()).toMatchObject({
      assignments: [],
      loading: false,
      error: 'Course service unavailable',
    });
  });

  it('loads proxy courses with the acting-for username without replacing the faculty member’s own list', async () => {
    useCourseAssignmentsStore.setState({ assignments: [course] });
    responseData = { success: true, courses: [{ ...course, assignment: { ...course.assignment, course_id: 'TEST-200' } }], can_edit: false };

    await useCourseAssignmentsStore.getState().fetchActingForAssignments('test-faculty');

    expect(capturedConfig).toBeDefined();
    const requestUrl = new URL(apiClient.getUri(capturedConfig));
    expect(requestUrl.pathname).toBe(`${COURSE_RESERVES_PATH}${COURSE_ASSIGNMENTS_PATH}`);
    expect(requestUrl.searchParams.get('acting_for_faculty_id')).toBe('test-faculty');
    expect(useCourseAssignmentsStore.getState()).toMatchObject({
      assignments: [course],
      actingForAssignments: [{ assignment: { course_id: 'TEST-200' } }],
      actingForCanEdit: false,
      actingForLoading: false,
      actingForError: null,
    });
  });

  it('clears acting-for course state when the selection is removed', () => {
    useCourseAssignmentsStore.getState().clearActingForAssignments();

    expect(useCourseAssignmentsStore.getState()).toMatchObject({
      actingForAssignments: [],
      actingForCanEdit: null,
      actingForLoading: false,
      actingForError: null,
    });
  });

  it.each([
    [403, 'No active proxy grant for this faculty member'],
    [409, 'The faculty member must re-invite you because their roster is unavailable'],
  ])('keeps the API message for acting-for errors with status %i', async (status, message) => {
    useCourseAssignmentsStore.setState({
      actingForAssignments: [course],
      actingForCanEdit: true,
    });
    const error = Object.assign(new Error(`Request failed with status code ${status}`), {
      response: { status, data: { message } },
    });
    adapterError = error;

    await expect(
      useCourseAssignmentsStore.getState().fetchActingForAssignments('test-faculty'),
    ).rejects.toBe(error);

    expect(useCourseAssignmentsStore.getState()).toMatchObject({
      actingForAssignments: [],
      actingForCanEdit: null,
      actingForLoading: false,
      actingForError: message,
    });
  });
});
