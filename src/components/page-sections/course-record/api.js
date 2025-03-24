
/**
 * Fetch all reserves/records for a given courseListingId.
 */
export async function fetchRecords(courseListingId) {
    const response = await fetch(
      `https://libtools2.smith.edu/folio/web/search/search-course-listings?courseListingId=${courseListingId}`
    );
    const results = await response.json();
    return results.data?.reserves || [];
  }

  
  /**
   * Fetch all course details for a given courseListingId.
   */
  export async function fetchCourseData(courseListingId) {
    const response = await fetch(
      `https://libtools2.smith.edu/folio/web/search/search-courses?query=(courseListingId=${courseListingId})`
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
      `https://libtools2.smith.edu/course-reserves/backend/web/course/get-resources?courseListingId=${courseListingId}`
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
      `https://libtools2.smith.edu/course-reserves/backend/web/offering-link/get-linked-resources?courseListingId=${courseListingId}`
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
      `https://libtools2.smith.edu/folio/web/springshare-course/search?course_code=${courseNumber}&semester=${encodeURIComponent(currentSemester)}`
    );
    const results = await response.json();
    return results;
  }
  
  /**
   * Fetch item availability for a given instanceId.
   */
  export async function fetchItemAvailabilityData(instanceId) {
    const response = await fetch(
      `https://libtools2.smith.edu/folio/web/search/search-rtac?id=${instanceId}`
    );
    const results = await response.json();
    let { holding } = results.data;
  
    if (!Array.isArray(holding)) {
      holding = holding ? [holding] : [];
    }
  
    return holding;
  }
  