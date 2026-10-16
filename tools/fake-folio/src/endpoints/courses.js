import { parseCql } from '../cql/parse.js';
import { matchesExpression, sortRecords } from '../cql/evaluate.js';
import { presentCourse } from '../data/views.js';

export function searchCourses(data, query) {
  const parsed = parseCql(query);
  const courses = data.courses.map((course) => presentCourse(course, data));
  const results = sortRecords(
    courses.filter((course) => matchesExpression(parsed.filter, course)),
    parsed.sort,
  );

  return {
    courses: results,
    totalRecords: results.length,
  };
}
