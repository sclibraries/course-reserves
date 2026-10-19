import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { createDataStore } from '../src/data/store.js';
import { createServer } from '../src/server.js';

const seedPath = fileURLToPath(new URL('../data/seed.json', import.meta.url));

async function withServer(run) {
  const directory = mkdtempSync(join(tmpdir(), 'fake-folio-test-'));
  const store = createDataStore({
    seedPath,
    runtimePath: join(directory, 'runtime.json'),
  });
  const server = createServer({ store });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();

  try {
    await run('http://127.0.0.1:' + address.port);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    rmSync(directory, { recursive: true, force: true });
  }
}

async function getJson(baseUrl, path) {
  const response = await fetch(baseUrl + path);
  return { response, body: await response.json() };
}

function assertEnvelope(body) {
  assert.equal(body.message, 'success');
  assert.equal(body.code, 200);
  assert.equal(typeof body.data, 'object');
}

test('search-terms returns both real-format terms and the complete listed fields', async () => {
  await withServer(async (baseUrl) => {
    const { response, body } = await getJson(baseUrl, '/folio/web/search/search-terms');
    const term = body.data.terms.find((item) => item.name === 'Spring 2027');

    assert.equal(response.status, 200);
    assertEnvelope(body);
    assert.ok(body.data.terms.length >= 2);
    for (const field of ['id', 'name', 'code', 'season', 'startDate', 'endDate']) {
      assert.ok(term[field], 'missing term field ' + field);
    }
  });
});

test('search-courses returns an array with all listed fields for one hit', async () => {
  await withServer(async (baseUrl) => {
    const terms = await getJson(baseUrl, '/folio/web/search/search-terms');
    const termId = terms.body.data.terms.find((item) => item.name === 'Spring 2027').id;
    const query = '(department.name=="SC*" and courseNumber=="TST 101" and ' +
      'courseListing.termId=="' + termId + '") sortby name';
    const { response, body } = await getJson(baseUrl, '/folio/web/search/search-courses?' +
      new URLSearchParams({ query }));
    const courses = body.data.courses;

    assert.equal(response.status, 200);
    assertEnvelope(body);
    assert.ok(Array.isArray(courses));
    assert.equal(courses.length, 1);
    const course = courses[0];
    for (const field of ['id', 'name', 'courseNumber', 'sectionName', 'departmentId',
      'departmentObject', 'courseListingId', 'courseListingObject']) {
      assert.ok(course[field], 'missing course field ' + field);
    }
    assert.notEqual(course.id, course.courseListingId);
    assert.ok(course.departmentObject.name);
    for (const field of ['id', 'termId', 'locationId', 'locationObject', 'registrarId',
      'instructorObjects', 'termObject']) {
      assert.ok(course.courseListingObject[field], 'missing listing field ' + field);
    }
    for (const field of ['id', 'name', 'code', 'startDate', 'endDate']) {
      assert.ok(course.courseListingObject.termObject[field], 'missing nested term field ' + field);
    }
  });
});

test('one-hit search JSON matches the API wrapper array contract', async () => {
  await withServer(async (baseUrl) => {
    const query = new URLSearchParams({ query: 'courseNumber=="TST 103"' });
    const response = await fetch(baseUrl + '/folio/web/search/search-courses?' + query);
    const body = JSON.parse(await response.text());

    assert.equal(response.status, 200);
    assertEnvelope(body);
    assert.ok(Array.isArray(body.data.courses));
    assert.equal(body.data.courses.length, 1);
    assert.equal(body.data.courses[0].courseNumber, 'TST 103');
  });
});

test('course id lookup does not match the distinct course listing id', async () => {
  await withServer(async (baseUrl) => {
    const terms = await getJson(baseUrl, '/folio/web/search/search-terms');
    const springTermId = terms.body.data.terms.find((term) => term.name === 'Spring 2027').id;
    const courseQuery = '(department.name=="SC*" and courseNumber=="TST 101" and ' +
      'courseListing.termId=="' + springTermId + '")';
    const courseSearch = await getJson(baseUrl, '/folio/web/search/search-courses?' +
      new URLSearchParams({ query: courseQuery }));
    const course = courseSearch.body.data.courses[0];
    const courseIdSearch = await getJson(baseUrl, '/folio/web/search/search-courses?' +
      new URLSearchParams({ query: 'id=="' + course.courseListingId + '"' }));
    const listingIdSearch = await getJson(baseUrl, '/folio/web/search/search-courses?' +
      new URLSearchParams({ query: 'courseListingId=="' + course.courseListingId + '"' }));

    assert.equal(courseSearch.body.data.courses.length, 1);
    assert.notEqual(course.id, course.courseListingId);
    assert.deepEqual(courseIdSearch.body.data.courses, []);
    assert.equal(listingIdSearch.body.data.courses[0].id, course.id);
  });
});

test('search-courses accepts raw-space sortby and returns an array for multiple hits', async () => {
  await withServer(async (baseUrl) => {
    const query = '(cql.allRecords=1)';
    const { response, body } = await getJson(baseUrl, '/folio/web/search/search-courses?query=' +
      encodeURIComponent(query) + ' sortby name');

    assert.equal(response.status, 200);
    assertEnvelope(body);
    assert.ok(Array.isArray(body.data.courses));
    assert.ok(body.data.courses.length >= 7);
    assert.equal(body.data.totalRecords, body.data.courses.length);
  });
});

test('seed contains each course scenario and keeps cross-listed course records on one listing', async () => {
  await withServer(async (baseUrl) => {
    const { body: terms } = await getJson(baseUrl, '/folio/web/search/search-terms');
    const { body } = await getJson(baseUrl, '/folio/web/search/search-courses?' +
      new URLSearchParams({ query: 'cql.allRecords=1' }));
    const courses = body.data.courses;
    const spring = terms.data.terms.find((term) => term.name === 'Spring 2027');
    const fall = terms.data.terms.find((term) => term.name === 'Fall 2026');
    const twoFive = courses.filter((course) =>
      course.courseNumber === 'TST 105' || course.courseNumber === 'TST 205');
    const course104 = courses.find((course) => course.courseNumber === 'TST 104');
    const course106Sections = courses.filter((course) => course.courseNumber === 'TST 106')
      .map((course) => course.sectionName).sort();

    assert.ok(spring.startDate.startsWith('2027-01-01'));
    assert.ok(fall.startDate.startsWith('2026-09-01'));
    assert.equal(courses.filter((course) => course.courseNumber === 'TST 101' &&
      ['Spring 2027', 'Fall 2026'].includes(course.courseListingObject.termObject.name)).length, 2);
    assert.equal(courses.find((course) => course.courseNumber === 'TST 103').sectionName, '02');
    assert.deepEqual(course104.courseListingObject.instructorObjects.map((i) => i.name).sort(),
      ['Test Faculty A', 'Test Faculty B']);
    assert.deepEqual(twoFive.map((course) => course.courseListingId),
      ['00000000-0000-4000-8000-000000000205', '00000000-0000-4000-8000-000000000205']);
    assert.deepEqual(course106Sections, ['01', '02']);
    assert.equal(courses.some((course) => course.courseNumber === 'TST 102'), false);
    assert.ok(courses.every((course) => course.id !== course.courseListingId));
  });
});

test('seed includes the synthetic past TST courses and three TST 101 reserves', async () => {
  await withServer(async (baseUrl) => {
    const { body: terms } = await getJson(baseUrl, '/folio/web/search/search-terms');
    const { body: courses } = await getJson(baseUrl, '/folio/web/search/search-courses?' +
      new URLSearchParams({ query: 'cql.allRecords=1' }));
    const spring2026 = terms.data.terms.find((term) => term.name === 'Spring 2026');
    const fall2025 = terms.data.terms.find((term) => term.name === 'Fall 2025');
    const previous101 = courses.data.courses.find((course) =>
      course.courseNumber === 'TST 101' && course.courseListingObject.termObject.name === 'Spring 2026');
    const previous107 = courses.data.courses.find((course) =>
      course.courseNumber === 'TST 107' && course.courseListingObject.termObject.name === 'Fall 2025');

    assert.ok(spring2026, 'missing Spring 2026 term');
    assert.ok(fall2025, 'missing Fall 2025 term');
    assert.ok(spring2026.startDate.startsWith('2026-01-01'));
    assert.ok(spring2026.endDate.startsWith('2026-05-31'));
    assert.ok(previous101, 'missing previous TST 101 listing');
    assert.ok(previous107, 'missing different-number past course');
    assert.deepEqual(previous101.courseListingObject.instructorObjects.map((instructor) => instructor.name),
      ['Test Faculty A']);

    const { response, body } = await getJson(baseUrl, '/folio/web/search/search-course-listings?' +
      new URLSearchParams({ courseListingId: previous101.courseListingId }));

    assert.equal(response.status, 200);
    assertEnvelope(body);
    assert.equal(body.data.reserves.length, 3);
    assert.deepEqual(body.data.reserves.map((reserve) => reserve.copiedItem.title), [
      'test-cx029-physical-reserve-1',
      'test-cx029-physical-reserve-2',
      'test-cx029-physical-reserve-3',
    ]);
    assert.deepEqual(body.data.reserves.map((reserve) => reserve.copiedItem.barcode), [
      'TEST-BARCODE-009', 'TEST-BARCODE-010', 'TEST-BARCODE-011',
    ]);
    assert.ok(body.data.reserves.every((reserve) => reserve.copiedItem.callNumber));
  });
});

test('search-courses names unsupported CQL in a 400 response', async () => {
  await withServer(async (baseUrl) => {
    const { response, body } = await getJson(baseUrl, '/folio/web/search/search-courses?' +
      new URLSearchParams({ query: 'unknownField=="x"' }));

    assert.equal(response.status, 400);
    assert.match(body.message, /unknownField/);
  });
});

test('search-course-listings returns reserves with every copied item field', async () => {
  await withServer(async (baseUrl) => {
    const courses = await getJson(baseUrl, '/folio/web/search/search-courses?' +
      new URLSearchParams({ query: 'courseNumber=="TST 101" and courseListing.termId=="00000000-0000-4000-8000-000000000002"' }));
    const listingId = courses.body.data.courses[0].courseListingId;
    const { response, body } = await getJson(baseUrl, '/folio/web/search/search-course-listings?' +
      new URLSearchParams({ courseListingId: listingId }));
    const reserve = body.data.reserves[0];
    const item = reserve.copiedItem;

    assert.equal(response.status, 200);
    assertEnvelope(body);
    for (const field of ['id', 'courseListingId', 'itemId', 'temporaryLoanTypeId', 'copiedItem']) {
      assert.ok(reserve[field], 'missing reserve field ' + field);
    }
    assert.equal(Object.hasOwn(reserve, 'course'), false);
    for (const field of ['title', 'instanceId', 'barcode', 'callNumber', 'copy', 'holdingsId',
      'permanentLocationId', 'uri', 'url', 'contributors', 'publication']) {
      assert.ok(Object.hasOwn(item, field), 'missing copied item field ' + field);
    }
    assert.ok(item.contributors[0].name);
    assert.ok(item.publication[0].publisher);
  });
});

test('search-reserves-with-courses filters item title and adds the listed course context', async () => {
  await withServer(async (baseUrl) => {
    const query = '(copiedItem.title="Foundations*" and ' +
      'courseListing.termId=="00000000-0000-4000-8000-000000000002") sortby name';
    const { response, body } = await getJson(baseUrl, '/folio/web/search/search-reserves-with-courses?' +
      new URLSearchParams({ college: 'SC', query }));
    const reserve = body.data.reserves[0];

    assert.equal(response.status, 200);
    assertEnvelope(body);
    assert.ok(reserve.copiedItem.title.startsWith('Foundations'));
    assert.deepEqual(Object.keys(reserve.course).sort(), [
      'courseListingObject', 'courseNumber', 'departmentObject', 'name', 'sectionName',
    ]);
    for (const field of ['name', 'courseNumber', 'sectionName', 'departmentObject',
      'courseListingObject']) {
      assert.ok(reserve.course[field], 'missing course field ' + field);
    }
    assert.ok(reserve.course.departmentObject.name);
    assert.deepEqual(Object.keys(reserve.course.courseListingObject).sort(), [
      'instructorObjects', 'locationObject', 'termObject',
    ]);
    for (const field of ['instructorObjects', 'termObject', 'locationObject']) {
      assert.ok(reserve.course.courseListingObject[field], 'missing listing field ' + field);
    }
    assert.ok(reserve.course.courseListingObject.instructorObjects[0].name);
    assert.deepEqual(Object.keys(reserve.course.courseListingObject.instructorObjects[0]), ['name']);
    assert.ok(reserve.course.courseListingObject.termObject.name);
    assert.ok(reserve.course.courseListingObject.locationObject.name);
  });
});

test('search-inventory returns contributor and publication data by instance id', async () => {
  await withServer(async (baseUrl) => {
    const { response, body } = await getJson(baseUrl, '/folio/web/search/search-inventory?' +
      new URLSearchParams({ query: 'id==00000000-0000-4000-8000-000000000301' }));
    const instance = body.data.instances[0];

    assert.equal(response.status, 200);
    assertEnvelope(body);
    assert.ok(instance.contributors[0].name);
    assert.ok(instance.publication[0].publisher);
  });
});

test('search-rtac preserves object and array holding shapes', async () => {
  await withServer(async (baseUrl) => {
    const one = await getJson(baseUrl, '/folio/web/search/search-rtac?id=00000000-0000-4000-8000-000000000301');
    const many = await getJson(baseUrl, '/folio/web/search/search-rtac?id=00000000-0000-4000-8000-000000000399');

    assertEnvelope(one.body);
    assert.equal(Array.isArray(one.body.data.holding), false);
    assertEnvelope(many.body);
    assert.ok(Array.isArray(many.body.data.holding));
    for (const field of ['id', 'barcode', 'location', 'library', 'status', 'callNumber',
      'volume', 'itemCopyNumber', 'materialType', 'temporaryLoanType', 'permanentLoanType',
      'uri', 'url']) {
      assert.ok(Object.hasOwn(one.body.data.holding, field), 'missing holding field ' + field);
    }
    assert.ok(one.body.data.holding.library.name);
    assert.ok(one.body.data.holding.materialType.name);
  });
});

test('search-departments accepts the app owner/active query and optional sortBy', async () => {
  await withServer(async (baseUrl) => {
    const query = 'owner==Smith College AND active==true';
    const { response, body } = await getJson(baseUrl, '/folio/web/search/search-departments?' +
      new URLSearchParams({ query: query + ' sortBy name/sort.ascending' }));

    assert.equal(response.status, 200);
    assertEnvelope(body);
    assert.ok(body.data.departments.length > 0);
    assert.ok(body.data.departments.every((item) => item.name.startsWith('SC')));
    assert.ok(body.data.departments[0].id);
  });
});

test('search-departments accepts the admin college name prefix and raw sortBy suffix', async () => {
  await withServer(async (baseUrl) => {
    const query = 'name==sc* sortBy name/sort.ascending';
    const { response, body } = await getJson(baseUrl, '/folio/web/search/search-departments?' +
      new URLSearchParams({ query }));

    assert.equal(response.status, 200);
    assertEnvelope(body);
    assert.deepEqual(body.data.departments.map((department) => department.name), [
      'SC Test Department', 'SC Test Humanities',
    ]);
  });
});

test('springshare-course/search returns the requested course and semester stub', async () => {
  await withServer(async (baseUrl) => {
    const { response, body } = await getJson(baseUrl, '/folio/web/springshare-course/search?' +
      new URLSearchParams({ course_code: 'TST 101', semester: 'Spring 2027' }));

    assert.equal(response.status, 200);
    assertEnvelope(body);
    assert.equal(body.data.course_code, 'TST 101');
    assert.equal(body.data.semester, 'Spring 2027');
    assert.ok(Array.isArray(body.data.resources));
  });
});

test('control page lists course, reserve, item, and reset actions', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(baseUrl + '/_fake-folio/');
    const html = await response.text();
    const state = await getJson(baseUrl, '/_fake-folio/api/state');

    assert.equal(response.status, 200);
    assert.match(html, /id="missing"/);
    assert.match(html, /create-scenario/);
    assert.match(html, /reserve/);
    assert.match(html, /checked out/);
    assert.match(html, /Reset to seed/);
    assert.ok(state.body.data.missingCourses.some((entry) =>
      entry.course.courseNumber === 'TST 102'));
    assert.ok(state.body.data.reserves.length > 0);
    assert.ok(state.body.data.items.some((item) => item.status === 'checked out'));
  });
});

test('control actions create the absent scenario, change reserve and item status, then reset', async () => {
  await withServer(async (baseUrl) => {
    const coursesUrl = '/folio/web/search/search-courses?';
    const missing = await getJson(baseUrl, coursesUrl +
      new URLSearchParams({ query: 'courseNumber=="TST 102"' }));
    assert.deepEqual(missing.body.data.courses, []);

    let response = await fetch(baseUrl + '/_fake-folio/api/courses', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ scenarioId: 'TST-102-01' }),
    });
    assert.equal(response.status, 201);
    let created = await response.json();
    assert.notEqual(created.data.course.id, created.data.course.courseListingId);
    const createdScenario = await getJson(baseUrl, coursesUrl +
      new URLSearchParams({ query: 'courseNumber=="TST 102"' }));
    assert.equal(createdScenario.body.data.courses[0].courseNumber, 'TST 102');

    response = await fetch(baseUrl + '/_fake-folio/api/courses', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        courseNumber: 'TST 199',
        name: 'TST 199 Test Template Course',
        sectionName: '01',
        termId: '00000000-0000-4000-8000-000000000001',
      }),
    });
    assert.equal(response.status, 201);
    created = await response.json();
    const createdTemplate = await getJson(baseUrl, coursesUrl +
      new URLSearchParams({ query: 'courseNumber=="TST 199"' }));
    assert.equal(createdTemplate.body.data.courses[0].id, created.data.course.id);

    const listingId = '00000000-0000-4000-8000-000000000201';
    const itemId = '00000000-0000-4000-8000-000000000303';
    response = await fetch(baseUrl + '/_fake-folio/api/reserves', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ courseListingId: listingId, itemId }),
    });
    assert.equal(response.status, 201);

    const reserves = await getJson(baseUrl, '/folio/web/search/search-course-listings?' +
      new URLSearchParams({ courseListingId: listingId }));
    assert.ok(reserves.body.data.reserves.some((reserve) => reserve.itemId === itemId));

    response = await fetch(baseUrl + '/_fake-folio/api/items/' + itemId + '/status', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'checked out' }),
    });
    assert.equal(response.status, 200);

    const rtac = await getJson(baseUrl, '/folio/web/search/search-rtac?id=00000000-0000-4000-8000-000000000303');
    assert.equal(rtac.body.data.holding.status, 'checked out');

    response = await fetch(baseUrl + '/_fake-folio/api/reserves', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ courseListingId: listingId, itemId }),
    });
    assert.equal(response.status, 200);
    const removedReserves = await getJson(baseUrl, '/folio/web/search/search-course-listings?' +
      new URLSearchParams({ courseListingId: listingId }));
    assert.equal(removedReserves.body.data.reserves.some((reserve) =>
      reserve.itemId === itemId), false);

    response = await fetch(baseUrl + '/_fake-folio/api/reset', { method: 'POST' });
    assert.equal(response.status, 200);

    const resetCourses = await getJson(baseUrl, coursesUrl +
      new URLSearchParams({ query: 'courseNumber=="TST 102"' }));
    assert.deepEqual(resetCourses.body.data.courses, []);
    const resetRtac = await getJson(baseUrl,
      '/folio/web/search/search-rtac?id=00000000-0000-4000-8000-000000000303');
    assert.equal(resetRtac.body.data.holding.status, 'available');
    const resetReserves = await getJson(baseUrl, '/folio/web/search/search-course-listings?' +
      new URLSearchParams({ courseListingId: listingId }));
    assert.equal(resetReserves.body.data.reserves.some((reserve) => reserve.itemId === itemId), false);
  });
});
