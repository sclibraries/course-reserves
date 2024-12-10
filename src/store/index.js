import { create } from 'zustand';

const initialState = {
  count: 0,
  query: '(cql.allRecords=1)',
  results: [],
  loading: false,
  error: null,
  sort: 'name',
  filters: [],
  limit: 100,
  baseUrl: 'https://libtools2.smith.edu/folio/web/search/search-courses',
  lastFetchedQuery: null, // Add this to track the last fetched query
};

const fetchResults = async (query) => {
    const { baseUrl, results, lastFetchedQuery } = useCourseStore.getState();

    // If we already have results for this query, do not refetch
    if (lastFetchedQuery === query && results && results.length > 0) {
      // Just ensure loading is false and return
      useCourseStore.setState({ loading: false });
      return;
    }

  useCourseStore.setState({ loading: true, error: null });
  try {
    const response = await fetch(`${baseUrl}?query=${encodeURIComponent(query)} sortby name`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const results = await response.json();
    const data = results.data;
    // Client-side filtering to include only active courses
    const currentDate = new Date();
    const activeCourses = data.courses.filter((course) => {
      const courseListing = course.courseListingObject;
      const term = courseListing?.termObject;
      const location = courseListing?.locationObject;

      if (!term || !location || !location.campusId) {
        return false;
      }

      const startDate = new Date(term.startDate);
      const endDate = new Date(term.endDate);
      endDate.setDate(endDate.getDate() + 1);

      const isActiveTerm = currentDate >= startDate && currentDate < endDate;
      return isActiveTerm;
    });

    useCourseStore.setState({
      results: activeCourses,
      loading: false,
      lastFetchedQuery: query, // Update the lastFetchedQuery after successful fetch
    });
  } catch (error) {
    useCourseStore.setState({ error, loading: false });
  }
};

const useCourseStore = create(() => ({
  ...initialState,
  fetchResults,
}));

export default useCourseStore;
