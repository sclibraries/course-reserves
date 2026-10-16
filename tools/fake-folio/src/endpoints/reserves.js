import { parseCql } from '../cql/parse.js';
import { matchesExpression, sortRecords } from '../cql/evaluate.js';
import { presentReserve } from '../data/views.js';

export function searchCourseListings(data, courseListingId) {
  const reserves = data.reserves
    .filter((reserve) => reserve.courseListingId === courseListingId)
    .map((reserve) => presentReserve(reserve, data));
  return { reserves };
}

export function searchReservesWithCourses(data, query, college) {
  const parsed = parseCql(query);
  let reserves = data.reserves.map((reserve) => {
    const course = data.courses.find((candidate) =>
      candidate.courseListingId === reserve.courseListingId);
    const view = presentReserve(reserve, data, true);
    return {
      view,
      queryRecord: { ...view, courseListingObject: { termId: course?.termId } },
    };
  }).filter(({ view }) => view.course);
  if (college) {
    reserves = reserves.filter(({ view }) =>
      view.course.departmentObject.name.startsWith(college));
  }
  const matching = reserves
    .filter(({ queryRecord }) => matchesExpression(parsed.filter, queryRecord))
    .map(({ view }) => view);
  return { reserves: sortRecords(matching, parsed.sort) };
}
