import { API_ENDPOINTS } from '@/config/endpoints';

const fetchCourseResourceEndpoint = (endpoint: string, courseListingId: string) => fetch(
  `${endpoint}?courseListingId=${courseListingId}`,
  {
    method: 'GET',
    headers: { Accept: 'application/json' },
    mode: 'cors',
    credentials: 'omit',
  }
);

export const fetchPhysicalCourseResources = (courseListingId: string) => (
  fetchCourseResourceEndpoint(
    `${API_ENDPOINTS.FOLIO.BASE_URL}${API_ENDPOINTS.FOLIO.SEARCH_COURSE_LISTINGS}`,
    courseListingId
  )
);

export const fetchMergedCourseResources = (courseListingId: string) => (
  fetchCourseResourceEndpoint(
    `${API_ENDPOINTS.COURSE_RESERVES.BASE_URL}${API_ENDPOINTS.COURSE_RESERVES.GET_MERGED_RESOURCES}`,
    courseListingId
  )
);
