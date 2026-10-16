import assert from 'node:assert/strict';
import test from 'node:test';
import { parseCql } from '../src/cql/parse.js';
import { matchesExpression, sortRecords } from '../src/cql/evaluate.js';

const termId = '00000000-0000-4000-8000-000000000001';
const course = {
  id: '00000000-0000-4000-8000-000000000111',
  name: 'TST 101 Test Biology',
  courseNumber: 'TST 101',
  sectionName: '01',
  courseListingId: '00000000-0000-4000-8000-000000000101',
  departmentObject: { name: 'SC Test Department' },
  courseListingObject: {
    termId,
    registrarId: 'TST-101-01-202701',
    instructorObjects: [{ name: 'Test Faculty A' }],
    termObject: { name: 'Spring 2027' },
  },
};

function queryMatches(query, record = course) {
  const parsed = parseCql(query);
  return matchesExpression(parsed.filter, record);
}

test('accepts the faculty exact course, department prefix, term, and sort form', () => {
  const query = '(department.name=="SC*" and courseNumber=="TST 101" and courseListing.termId=="' +
    termId + '") sortby name';
  const parsed = parseCql(query);

  assert.equal(matchesExpression(parsed.filter, course), true);
  assert.deepEqual(parsed.sort, { field: 'name', direction: 'ascending' });
});

test('accepts faculty all-fields OR searches with prefix values and nested parentheses', () => {
  const query = '(department.name=="SC*" and (name="No match*" or courseNumber="TST 101*" or ' +
    'sectionName="99*" or courseListing.instructorObjects="Test Faculty A*" or ' +
    'courseListing.registrarId="TST-101-01-202701"))';

  assert.equal(queryMatches(query), true);
});

test('accepts the admin course-import and course-name prefix searches', () => {
  const importQuery = '(department.name=="SC*" and (name="TST 101*" or ' +
    'courseNumber="TST 101*" or sectionName="TST 101*" or ' +
    'courseListing.registrarId="TST 101*")) sortby name';
  const adminQuery = '(name="TST 101*" or courseNumber="TST 101*")';

  assert.equal(queryMatches(importQuery), true);
  assert.equal(queryMatches(adminQuery), true);
});

test('accepts each faculty search key and optional exact department filter', () => {
  const queries = [
    '(department.name=="SC*" and name="TST 101*")',
    '(department.name=="SC*" and courseNumber="TST 101*")',
    '(department.name=="SC*" and sectionName="01*")',
    '(department.name=="SC*" and courseListing.instructorObjects="Test Faculty A*")',
    '(department.name=="SC*" and courseListing.registrarId="TST-101-01-202701*")',
    '(department.name=="SC Test Department" and courseNumber=="TST 101")',
  ];

  for (const query of queries) assert.equal(queryMatches(query), true, query);
});

test('accepts exact course number and instructor prefix sorted by nested term name', () => {
  const query = '(courseNumber=="TST 101" and department.name=="SC*" and ' +
    'courseListing.instructorObjects="Test Faculty A*") sortby ' +
    'courseListing.termObject.name/sort.descending';
  const parsed = parseCql(query);

  assert.equal(matchesExpression(parsed.filter, course), true);
  assert.deepEqual(parsed.sort, {
    field: 'courseListing.termObject.name',
    direction: 'descending',
  });
});

test('accepts all-records and exact course-listing-id forms', () => {
  assert.equal(queryMatches('(cql.allRecords=1)'), true);
  assert.equal(queryMatches('(courseListingId=' + course.courseListingId + ')'), true);
  assert.equal(queryMatches('(id=="' + course.id + '")'), true);
  assert.equal(queryMatches('(id=="00000000-0000-4000-8000-000000000999")'), false);
});

test('uses AND precedence before OR and handles explicit grouping', () => {
  assert.equal(queryMatches('(courseNumber=="TST 101" or sectionName=="02" and name=="wrong")'), true);
  assert.equal(queryMatches('((courseNumber=="wrong" or sectionName=="01") and department.name=="SC*")'), true);
});

test('accepts item title prefix queries combined with term and sort', () => {
  const reserve = {
    copiedItem: { title: 'Foundations of Test Biology' },
    course: { courseListingObject: { termId } },
  };
  const parsed = parseCql('(copiedItem.title="Foundations*" and courseListing.termId=="' +
    termId + '") sortby name');

  assert.equal(matchesExpression(parsed.filter, reserve), true);
  assert.deepEqual(sortRecords([{ name: 'B' }, { name: 'A' }], parsed.sort)
    .map((item) => item.name), ['A', 'B']);
});

test('accepts department service queries with unquoted spaces and case-insensitive AND', () => {
  const department = { owner: 'Smith College', active: true, name: 'SC Test Department' };
  const parsed = parseCql('owner==Smith College AND active==true sortBy name/sort.ascending');

  assert.equal(matchesExpression(parsed.filter, department), true);
  assert.deepEqual(parsed.sort, { field: 'name', direction: 'ascending' });
});

test('rejects unsupported operators, fields, sort modifiers, and incomplete expressions', () => {
  for (const query of [
    'courseNumber>=1',
    'unsupportedField=="x"',
    '(courseNumber=="TST 101" and)',
    'courseNumber=="TST 101" sortby name/sort.random',
  ]) {
    assert.throws(() => parseCql(query), new RegExp(query.includes('unsupportedField')
      ? 'unsupportedField'
      : query.includes('>=') ? '>=' : query.includes('sort.random') ? 'sort.random' : 'query'));
  }
});
