import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import useCourseStore from './index';
import useAdminSearchStore from './adminSearchStore';
import { useBuildQuery } from '../hooks/useBuildQuery';

vi.mock('zustand/middleware', () => ({ persist: (creator) => creator }));

const response = (body) => ({ ok: true, json: async () => body });
const dateOffset = (days) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

const terms = [
  { id: 'term-current', name: '2026 Fall', startDate: dateOffset(-1), endDate: dateOffset(1) },
  { id: 'term-next', name: '2027 Spring', startDate: dateOffset(30), endDate: dateOffset(120) },
];

const courses = [
  { id: 'fall-course', name: 'Synthetic Fall course' },
  { id: 'spring-course-1', name: 'Synthetic Spring course 1' },
  { id: 'spring-course-2', name: 'Synthetic Spring course 2' },
  { id: 'spring-course-3', name: 'Synthetic Spring course 3' },
  { id: 'spring-course-4', name: 'Synthetic Spring course 4' },
  { id: 'spring-course-5', name: 'Synthetic Spring course 5' },
  { id: 'spring-course-6', name: 'Synthetic Spring course 6' },
  { id: 'spring-course-7', name: 'Synthetic Spring course 7' },
];

describe('admin course term selection', () => {
  let resolveDelayedTerms;
  let courseQueries;

  beforeEach(() => {
    useAdminSearchStore.setState({
      college: 'all',
      type: 'all',
      query: '',
      limit: '100',
      department: '',
      sortOption: '',
      termId: null,
      terms: [],
      sort: 'name',
      defaultsSet: false,
      termSelectionMade: false,
      termsLoading: false,
    });
    useCourseStore.setState({ results: [], loading: false, error: null, lastFetchedQuery: null });
    courseQueries = [];

    let termRequestCount = 0;
    vi.stubGlobal('fetch', vi.fn((url) => {
      if (String(url).includes('/search/search-terms')) {
        termRequestCount += 1;
        if (termRequestCount === 1) {
          return new Promise((resolve) => {
            resolveDelayedTerms = () => resolve(response({ data: { terms } }));
          });
        }
        return Promise.resolve(response({ data: { terms } }));
      }

      const query = new URL(String(url)).searchParams.get('query');
      courseQueries.push(query);
      const results = query.includes('term-current')
        ? courses.slice(0, 1)
        : query.includes('term-next')
          ? courses.slice(1)
          : courses;
      return Promise.resolve(response({ data: { courses: results } }));
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps All Terms after a delayed defaults fetch and refreshes every term', async () => {
    const store = useAdminSearchStore.getState();
    const delayedDefaultFetch = store.fetchTerms(true);
    await useAdminSearchStore.getState().fetchTerms();

    useAdminSearchStore.getState().initializeDefaults('Smith College', 'term-current');
    expect(useAdminSearchStore.getState().termId).toBe('term-current');

    const currentTermQuery = useBuildQuery('smith', 'all', '', '', null, 'term-current');
    await useCourseStore.getState().fetchResults(currentTermQuery);
    expect(useCourseStore.getState().results).toHaveLength(1);

    useAdminSearchStore.getState().setTermId('term-next');
    const selectedTermQuery = useBuildQuery('smith', 'all', '', '', null, 'term-next');
    await useCourseStore.getState().fetchResults(selectedTermQuery);
    expect(useCourseStore.getState().results).toHaveLength(7);

    useAdminSearchStore.getState().setTermId(null);
    resolveDelayedTerms();
    await delayedDefaultFetch;

    const allTermsQuery = useBuildQuery(
      useAdminSearchStore.getState().college,
      'all',
      '',
      '',
      null,
      useAdminSearchStore.getState().termId
    );

    expect(useAdminSearchStore.getState().termId).toBeNull();
    expect(allTermsQuery).toBe('(department.name=="SC*")');

    await useCourseStore.getState().fetchResults(allTermsQuery);

    expect(courseQueries).toHaveLength(3);
    expect(courseQueries[2]).toBe('(department.name=="SC*") sortby name');
    expect(useCourseStore.getState().results).toHaveLength(8);
  });

  it('sets the current term when the initial defaults fetch resolves', async () => {
    const initialFetch = useAdminSearchStore.getState().fetchTerms(true);
    resolveDelayedTerms();
    await initialFetch;

    expect(useAdminSearchStore.getState().termId).toBe('term-current');
  });

  it('replaces a persisted term id missing from the loaded terms with the current term', async () => {
    useAdminSearchStore.setState({
      termId: 'term-removed',
      defaultsSet: true,
      termSelectionMade: true,
    });

    const loadTerms = useAdminSearchStore.getState().fetchTerms(true);
    resolveDelayedTerms();
    await loadTerms;

    const currentTermId = useAdminSearchStore.getState().termId;
    const query = useBuildQuery('smith', 'all', '', '', null, currentTermId);

    expect(currentTermId).toBe('term-current');
    expect(query).toContain('courseListing.termId=="term-current"');
  });

  it('keeps a persisted explicit All Terms choice after terms load', async () => {
    useAdminSearchStore.setState({
      termId: null,
      defaultsSet: true,
      termSelectionMade: true,
    });

    const loadTerms = useAdminSearchStore.getState().fetchTerms(true);
    resolveDelayedTerms();
    await loadTerms;

    const query = useBuildQuery('smith', 'all', '', '', null, useAdminSearchStore.getState().termId);

    expect(useAdminSearchStore.getState().termId).toBeNull();
    expect(query).toBe('(department.name=="SC*")');
  });

  it('does not replace an explicit All Terms choice with a delayed default', async () => {
    const delayedDefaultFetch = useAdminSearchStore.getState().fetchTerms(true);
    await useAdminSearchStore.getState().fetchTerms();
    useAdminSearchStore.getState().setTermId('term-next');
    useAdminSearchStore.getState().setTermId(null);

    resolveDelayedTerms();
    await delayedDefaultFetch;

    expect(useAdminSearchStore.getState().termId).toBeNull();
  });

  it('applies the institution default without replacing an earlier All Terms choice', () => {
    useAdminSearchStore.getState().setTermId(null);
    useAdminSearchStore.getState().initializeDefaults('Smith College', 'term-current');

    expect(useAdminSearchStore.getState().college).toBe('smith');
    expect(useAdminSearchStore.getState().termId).toBeNull();
  });
});
