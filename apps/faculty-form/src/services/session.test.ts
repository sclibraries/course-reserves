import { describe, expect, it } from 'vitest';
import {
  buildFacultyAuthorizeUrl,
  getPostLoginDestination,
  mergeUserScopedState,
  readSessionFromCookie,
  routePathFromAppPath,
} from './session';

const now = 1_800_000_000;
const payload = {
  username: 'test-faculty-a',
  role: 'faculty',
  id: 'test-faculty-a',
  full_name: 'Test Faculty A',
  email: 'test-faculty-a@example.edu',
  institution: 'SM',
  internal_id: 'test-id-123',
  iat: now - 30,
  exp: now + 60,
};

const tokenFor = (claims: Record<string, unknown>) => {
  const encode = (value: string) => btoa(value).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${encode('{"alg":"none"}')}.${encode(JSON.stringify(claims))}.synthetic-signature`;
};

describe('session helpers', () => {
  it.each([
    ['valid access token restores its identity', `accessToken=${encodeURIComponent(tokenFor(payload))}`, payload],
    ['expired access token is rejected', `accessToken=${encodeURIComponent(tokenFor({ ...payload, exp: now }))}`, null],
    ['malformed JWT is rejected', 'accessToken=header.payload.signature', null],
    ['malformed cookie encoding is rejected', 'accessToken=%E0%A4%A', null],
    ['missing access token is rejected', 'other=value', null],
  ])('%s', (_name, cookie, expected) => {
    const session = readSessionFromCookie(cookie, now);
    expect(session).toEqual(expected);
  });

  it.each([
    [
      'keeps an in-basename return path and its query and hash',
      '/form/submission/test-1?tab=items#item-2',
      'https://faculty.example.edu/course-reserves/backend/admin/faculty-authorize.php?redirect=https%3A%2F%2Ffaculty.example.edu%2Fform%2Fsubmission%2Ftest-1%3Ftab%3Ditems%23item-2',
    ],
    [
      'falls back when the path only shares a basename prefix',
      '/form-other/submission/test-1?tab=items#item-2',
      'https://faculty.example.edu/course-reserves/backend/admin/faculty-authorize.php?redirect=https%3A%2F%2Ffaculty.example.edu%2Fform%2F',
    ],
  ])('%s', (_name, path, expected) => {
    expect(buildFacultyAuthorizeUrl(
      'https://faculty.example.edu/course-reserves/backend/admin/faculty-authorize.php',
      'https://faculty.example.edu',
      '/form/',
      path,
    )).toBe(expected);
  });

  it.each([
    ['pending invitation wins over a saved path', 'test-invitation-token', '/form/submission/test-1', '/faculty/accept-proxy-invitation/test-invitation-token'],
    ['saved path keeps query and hash', null, '/form/submission/test-1?tab=items#item-2', '/submission/test-1?tab=items#item-2'],
    ['outside-basename path falls back to the dashboard', null, '/form-other/submission/test-1', '/'],
    ['missing destinations fall back to the dashboard', null, null, '/'],
  ])('%s', (_name, invitation, saved, expected) => {
    const destination = getPostLoginDestination(invitation, saved, '/form/');
    expect(routePathFromAppPath(destination, '/form/')).toBe(expected);
  });

  it.each([
    ['same user', 'test-faculty-a', 'test-faculty-a', { values: ['kept'], ownerUsername: 'test-faculty-a' }],
    ['another user', 'test-faculty-a', 'test-faculty-b', null],
    ['missing stamp', null, 'test-faculty-b', null],
  ])('merges stored data only for the stamped %s', (_name, owner, username, expected) => {
    const current = { values: [], ownerUsername: null };
    const persisted = { values: ['kept'], ownerUsername: owner };
    expect(mergeUserScopedState(persisted, current, username)).toEqual(expected);
  });
});
