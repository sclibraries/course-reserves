
const BASE_URL = import.meta.env.VITE_BASE_API_URL || 'https://libtools2.smith.edu';
const CR_PATH = import.meta.env.VITE_COURSE_RESERVES_PATH || '/course-reserves/backend/web';
const FOLIO_PATH = import.meta.env.VITE_FOLIO_PATH || '/folio/web';

export async function fetchMergedResources(courseListingId) {
  const res = await fetch(
    `${BASE_URL}${CR_PATH}/course/get-merged-resources?courseListingId=${courseListingId}`
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  return json;
}

/**
 * Fetch all reserves/records for a given courseListingId.
 */
export async function fetchRecords(courseListingId) {
  const response = await fetch(
    `${BASE_URL}${FOLIO_PATH}/search/search-course-listings?courseListingId=${courseListingId}`
  );
  const results = await response.json();
  return results.data?.reserves || [];
}

/**
 * Fetch all course details for a given courseListingId.
 */
export async function fetchCourseData(courseListingId) {
  const response = await fetch(
    `${BASE_URL}${FOLIO_PATH}/search/search-courses?query=(courseListingId=${courseListingId})`
  );
  const results = await response.json();
  return results.data?.courses || [];
}

/**
 * Fetch electronic reserves for a given courseListingId.
 */
export async function fetchElectronicReserves(courseListingId) {
  try {
    const response = await fetch(
      `${BASE_URL}${CR_PATH}/course/get-resources?courseListingId=${courseListingId}`
    );
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const results = await response.json();
    return results.resources || [];
  } catch (err) {
    console.error("Error fetching electronic reserves:", err);
    throw err;
  }
}

/**
 * Fetch cross linked courses for a given courseListingId.
 */
export async function fetchCrossLinkedCourses(courseListingId) {
  try {
    const response = await fetch(
      `${BASE_URL}${CR_PATH}/offering-link/get-linked-resources?courseListingId=${courseListingId}`
    );
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const results = await response.json();
    return results.resources || [];
  } catch (err) {
    console.error("Error fetching cross linked courses:", err);
    throw err;
  }
}

/**
 * Fetch Springshare data for a given course number.
 */
export async function fetchSpringShareData(courseNumber, currentSemester) {
  const response = await fetch(
    `${BASE_URL}${FOLIO_PATH}/springshare-course/search?course_code=${courseNumber}&semester=${encodeURIComponent(currentSemester)}`
  );
  const results = await response.json();
  return results;
}

/**
 * Fetch item availability for a given instanceId.
 */
export async function fetchItemAvailabilityData(instanceId) {
  const response = await fetch(
    `${BASE_URL}${FOLIO_PATH}/search/search-rtac?id=${instanceId}`
  );
  const results = await response.json();
  let { holding } = results.data;

  if (!Array.isArray(holding)) {
    holding = holding ? [holding] : [];
  }

  return holding;
}

  