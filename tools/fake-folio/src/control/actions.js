import { randomUUID } from 'node:crypto';

const itemStatuses = new Set(['available', 'checked out', 'lost']);

export class ControlError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'ControlError';
    this.status = status;
  }
}

function requireString(value, name) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new ControlError(400, name + ' is required');
  }
  return value.trim();
}

export function controlState(data) {
  return {
    terms: data.terms,
    courses: data.courses,
    missingCourses: data.missingCourses,
    items: data.items,
    reserves: data.reserves,
  };
}

export function createCourse(data, input) {
  let course;
  if (input.scenarioId) {
    const scenario = data.missingCourses.find((entry) =>
      entry.scenarioId === input.scenarioId);
    if (!scenario) throw new ControlError(404, 'Unknown missing course scenario');
    course = scenario.course;
    data.missingCourses = data.missingCourses.filter((entry) =>
      entry.scenarioId !== input.scenarioId);
  } else {
    const courseNumber = requireString(input.courseNumber, 'courseNumber');
    const termId = input.termId || data.terms[0].id;
    const term = data.terms.find((candidate) => candidate.id === termId);
    if (!term) throw new ControlError(400, 'termId does not match a seeded term');
    const department = data.departments[0];
    const sectionName = input.sectionName || '01';
    const normalized = courseNumber.replace(/\s+/g, '-');
    let instructorNames = [];
    if (Array.isArray(input.instructors)) {
      instructorNames = input.instructors;
    } else if (typeof input.instructors === 'string') {
      instructorNames = input.instructors.split(',')
        .map((name) => name.trim())
        .filter(Boolean);
    }
    course = {
      id: randomUUID(),
      name: requireString(input.name || courseNumber, 'name'),
      courseNumber,
      sectionName,
      departmentId: department.id,
      departmentName: department.name,
      courseListingId: randomUUID(),
      termId,
      locationId: '00000000-0000-4000-8000-000000000601',
      locationName: 'Neilson Library',
      registrarId: normalized + '-' + sectionName + '-' + term.code.slice(0, 4) +
        (term.name.includes('Spring') ? '01' : '09'),
      instructors: instructorNames.map((name) => ({
        id: randomUUID(),
        name: requireString(name, 'instructor name'),
      })),
    };
  }

  if (course.id === course.courseListingId) {
    throw new ControlError(400, 'Course id and courseListingId must differ');
  }
  data.courses.push(course);
  return course;
}

export function addReserve(data, input) {
  const courseListingId = requireString(input.courseListingId, 'courseListingId');
  const itemId = requireString(input.itemId, 'itemId');
  if (!data.courses.some((course) => course.courseListingId === courseListingId)) {
    throw new ControlError(404, 'Course listing was not found');
  }
  if (!data.items.some((item) => item.id === itemId)) {
    throw new ControlError(404, 'Item was not found');
  }
  if (data.reserves.some((reserve) =>
    reserve.courseListingId === courseListingId && reserve.itemId === itemId)) {
    throw new ControlError(409, 'Item is already on reserve for this course');
  }

  const reserve = {
    id: randomUUID(),
    courseListingId,
    itemId,
    temporaryLoanTypeId: randomUUID(),
  };
  data.reserves.push(reserve);
  return reserve;
}

export function removeReserve(data, input) {
  const courseListingId = requireString(input.courseListingId, 'courseListingId');
  const itemId = requireString(input.itemId, 'itemId');
  const index = data.reserves.findIndex((reserve) =>
    reserve.courseListingId === courseListingId && reserve.itemId === itemId);
  if (index < 0) throw new ControlError(404, 'Reserve was not found');
  return data.reserves.splice(index, 1)[0];
}

export function setItemStatus(data, itemId, status) {
  const item = data.items.find((candidate) => candidate.id === itemId);
  if (!item) throw new ControlError(404, 'Item was not found');
  if (!itemStatuses.has(status)) throw new ControlError(400, 'Unsupported item status: ' + status);
  item.status = status;
  return item;
}
