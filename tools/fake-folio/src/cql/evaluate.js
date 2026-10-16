import { CqlError } from './tokenize.js';

function resolvePath(record, path) {
  if (path === 'department.name') {
    return record.departmentObject?.name || record.course?.departmentObject?.name || '';
  }
  if (path === 'courseListingId') {
    return record.courseListingId || record.course?.courseListingId || '';
  }
  if (path === 'courseListing.instructorObjects') {
    const listing = record.courseListingObject || record.course?.courseListingObject;
    return (listing?.instructorObjects || []).map((instructor) => instructor.name || '');
  }
  if (path.startsWith('courseListing.')) {
    const listing = record.courseListingObject || record.course?.courseListingObject;
    return path.slice('courseListing.'.length).split('.')
      .reduce((value, key) => value?.[key], listing);
  }
  if (path === 'copiedItem.title') return record.copiedItem?.title || '';
  if (path === 'name' && record.copiedItem) return record.copiedItem.title;
  return path.split('.').reduce((value, key) => value?.[key], record);
}

function equal(value, expected) {
  return String(value ?? '') === expected;
}

function prefix(value, expected) {
  const requested = expected.slice(0, -1).toLocaleLowerCase();
  return String(value ?? '').toLocaleLowerCase().startsWith(requested);
}

function compare(record, expression) {
  const value = resolvePath(record, expression.field);
  if (expression.field === 'cql.allRecords') return expression.value === '1';

  const values = Array.isArray(value) ? value : [value];
  return values.some((candidate) => {
    if (expression.operator === '=' && expression.value.endsWith('*')) {
      return prefix(candidate, expression.value);
    }
    // Smith's current course builder uses == with SC* for a department prefix.
    if (expression.field === 'department.name' && expression.operator === '==' &&
      expression.value.endsWith('*')) {
      return prefix(candidate, expression.value);
    }
    return equal(candidate, expression.value);
  });
}

export function matchesExpression(expression, record) {
  if (expression.type === 'comparison') return compare(record, expression);
  if (expression.type === 'and') {
    return matchesExpression(expression.left, record) && matchesExpression(expression.right, record);
  }
  if (expression.type === 'or') {
    return matchesExpression(expression.left, record) || matchesExpression(expression.right, record);
  }
  throw new CqlError('Unsupported CQL expression type: ' + expression.type);
}

export function sortRecords(records, sort) {
  if (!sort) return [...records];
  const ordered = [...records].sort((left, right) => {
    const a = resolvePath(left, sort.field);
    const b = resolvePath(right, sort.field);
    const result = String(a ?? '').localeCompare(String(b ?? ''), undefined, {
      sensitivity: 'base',
      numeric: true,
    });
    return sort.direction === 'descending' ? -result : result;
  });
  return ordered;
}
