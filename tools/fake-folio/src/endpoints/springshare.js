export function searchSpringshare(data, courseCode, semester) {
  const matches = data.springshare.course_code === courseCode &&
    data.springshare.semester === semester;
  return {
    course_code: courseCode,
    semester,
    resources: matches ? data.springshare.resources : [],
  };
}
