import { createServer as createHttpServer } from 'node:http';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ControlError, addReserve, controlState, createCourse, removeReserve, setItemStatus } from './control/actions.js';
import { controlPage } from './control/page.js';
import { CqlError } from './cql/tokenize.js';
import { createDataStore } from './data/store.js';
import { searchCourses } from './endpoints/courses.js';
import { searchDepartments } from './endpoints/departments.js';
import { searchInventory } from './endpoints/inventory.js';
import { searchCourseListings, searchReservesWithCourses } from './endpoints/reserves.js';
import { searchRtac } from './endpoints/rtac.js';
import { searchSpringshare } from './endpoints/springshare.js';
import { searchTerms } from './endpoints/terms.js';

class RequestError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function sendJson(response, status, payload) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  response.end(JSON.stringify(payload));
}

function envelope(data) {
  return { message: 'success', code: 200, data };
}

function requiredParameter(url, key) {
  const value = url.searchParams.get(key);
  if (!value) throw new RequestError(400, 'Missing required query parameter: ' + key);
  return value;
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 65536) throw new RequestError(413, 'Request body exceeds 64 KB');
    chunks.push(chunk);
  }
  if (size === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new RequestError(400, 'Request body must be valid JSON');
  }
}

async function handleControl(request, response, url, store) {
  const { pathname } = url;
  if ((pathname === '/_fake-folio' || pathname === '/_fake-folio/') &&
    request.method === 'GET') {
    response.writeHead(200, {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
    });
    response.end(controlPage);
    return;
  }

  if (pathname === '/_fake-folio/api/state' && request.method === 'GET') {
    sendJson(response, 200, envelope(controlState(store.read())));
    return;
  }
  if (pathname === '/_fake-folio/api/reset' && request.method === 'POST') {
    store.reset();
    sendJson(response, 200, envelope({ reset: true }));
    return;
  }
  if (pathname === '/_fake-folio/api/courses' && request.method === 'POST') {
    const input = await readJson(request);
    const course = store.update((data) => createCourse(data, input));
    sendJson(response, 201, envelope({ course }));
    return;
  }
  if (pathname === '/_fake-folio/api/reserves' &&
    (request.method === 'POST' || request.method === 'DELETE')) {
    const input = await readJson(request);
    const reserve = store.update((data) => request.method === 'POST'
      ? addReserve(data, input)
      : removeReserve(data, input));
    sendJson(response, request.method === 'POST' ? 201 : 200, envelope({ reserve }));
    return;
  }

  const statusMatch = pathname.match(/^\/_fake-folio\/api\/items\/([^/]+)\/status$/);
  if (statusMatch && request.method === 'PATCH') {
    const input = await readJson(request);
    const item = store.update((data) =>
      setItemStatus(data, decodeURIComponent(statusMatch[1]), input.status));
    sendJson(response, 200, envelope({ item }));
    return;
  }
  throw new RequestError(404, 'Fake FOLIO control route not found');
}

async function dispatch(request, response, store) {
  const url = new URL(request.url, 'http://fake-folio.local');
  try {
    if (url.pathname.startsWith('/_fake-folio')) {
      await handleControl(request, response, url, store);
      return;
    }
    if (request.method !== 'GET') throw new RequestError(405, 'FOLIO endpoints accept GET only');

    const data = store.read();
    let result;
    switch (url.pathname) {
      case '/folio/web/search/search-terms':
        result = searchTerms(data);
        break;
      case '/folio/web/search/search-courses':
        result = searchCourses(data, requiredParameter(url, 'query'));
        break;
      case '/folio/web/search/search-course-listings':
        result = searchCourseListings(data, requiredParameter(url, 'courseListingId'));
        break;
      case '/folio/web/search/search-reserves-with-courses':
        result = searchReservesWithCourses(
          data,
          requiredParameter(url, 'query'),
          url.searchParams.get('college') || '',
        );
        break;
      case '/folio/web/search/search-inventory':
        result = searchInventory(data, requiredParameter(url, 'query'));
        break;
      case '/folio/web/search/search-rtac':
        result = searchRtac(data, requiredParameter(url, 'id'));
        break;
      case '/folio/web/search/search-departments': {
        let query = url.searchParams.get('query') || '(cql.allRecords=1)';
        const sortBy = url.searchParams.get('sortBy');
        if (sortBy && !/\bsortby\b/i.test(query)) query += ' sortby ' + sortBy;
        result = searchDepartments(data, query);
        break;
      }
      case '/folio/web/springshare-course/search':
        result = searchSpringshare(
          data,
          url.searchParams.get('course_code') || '',
          url.searchParams.get('semester') || '',
        );
        break;
      default:
        throw new RequestError(404, 'Fake FOLIO endpoint not found: ' + url.pathname);
    }
    sendJson(response, 200, envelope(result));
  } catch (error) {
    let status = error.status || 500;
    if (error instanceof CqlError) status = 400;
    if (error instanceof ControlError) status = error.status;
    const message = error instanceof CqlError
      ? 'Unsupported query: ' + error.message
      : error.message;
    sendJson(response, status, {
      message,
      code: status,
      data: null,
    });
  }
}

export function createServer({ store }) {
  return createHttpServer((request, response) => {
    dispatch(request, response, store);
  });
}

function start() {
  const root = new URL('../', import.meta.url);
  const seedPath = fileURLToPath(new URL('data/seed.json', root));
  const runtimePath = process.env.FAKE_FOLIO_RUNTIME_FILE ||
    fileURLToPath(new URL('runtime/state.json', root));
  const store = createDataStore({ seedPath, runtimePath });
  const port = Number(process.env.PORT || 3000);
  createServer({ store }).listen(port, '0.0.0.0', () => {
    process.stdout.write('Fake FOLIO listening on port ' + port + '\n');
  });
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) start();
