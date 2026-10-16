export function presentCourse(course, data) {
  const term = data.terms.find((candidate) => candidate.id === course.termId) || {};
  return {
    id: course.id,
    name: course.name,
    courseNumber: course.courseNumber,
    sectionName: course.sectionName,
    departmentId: course.departmentId,
    departmentObject: { name: course.departmentName },
    courseListingId: course.courseListingId,
    courseListingObject: {
      id: course.courseListingId,
      termId: course.termId,
      locationId: course.locationId,
      locationObject: { name: course.locationName },
      registrarId: course.registrarId,
      instructorObjects: course.instructors,
      termObject: {
        id: term.id,
        name: term.name,
        code: term.code,
        startDate: term.startDate,
        endDate: term.endDate,
      },
    },
  };
}

export function presentCopiedItem(item) {
  const fields = [
    'title',
    'instanceId',
    'barcode',
    'callNumber',
    'copy',
    'holdingsId',
    'permanentLocationId',
    'uri',
    'url',
    'contributors',
    'publication',
  ];
  return Object.fromEntries(fields.map((field) => [field, item[field] ?? '']));
}

function presentReserveCourse(course, data) {
  const term = data.terms.find((candidate) => candidate.id === course.termId) || {};
  return {
    name: course.name,
    courseNumber: course.courseNumber,
    sectionName: course.sectionName,
    departmentObject: { name: course.departmentName },
    courseListingObject: {
      instructorObjects: course.instructors.map(({ name }) => ({ name })),
      termObject: { name: term.name },
      locationObject: { name: course.locationName },
    },
  };
}

export function presentReserve(reserve, data, includeCourse = false) {
  const item = data.items.find((candidate) => candidate.id === reserve.itemId);
  const course = data.courses.find((candidate) =>
    candidate.courseListingId === reserve.courseListingId);
  return {
    id: reserve.id,
    courseListingId: reserve.courseListingId,
    itemId: reserve.itemId,
    temporaryLoanTypeId: reserve.temporaryLoanTypeId,
    copiedItem: item ? presentCopiedItem(item) : null,
    ...(includeCourse && course ? { course: presentReserveCourse(course, data) } : {}),
  };
}
