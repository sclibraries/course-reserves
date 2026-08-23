# Student Visibility Preview Hotfix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an authenticated staff-only student preview that enforces logged-out resource and link visibility without changing production authentication, backend behavior, or workflow exposure.

**Architecture:** Keep the real session intact and derive a separate `canBypassVisibility` boolean from authentication plus the `preview=student` query parameter. `CourseRecords` owns preview state and passes visibility authority explicitly to `RecordCard` and `RecordTable`; pure URL and policy helpers provide unit-test coverage without adding dependencies.

**Tech Stack:** React 18, React Router, Reactstrap, Vitest 3, ESLint 9, Vite 5

**Spec:** `docs/superpowers/specs/2026-08-21-student-visibility-preview-hotfix-design.md`

## Global Constraints

- Base all work on production commit `eacfc14d8fdff51030b989f6fd640c8357d44973`.
- Do not change `AuthContext`, cookies, tokens, permissions, backend APIs, or persisted visibility data.
- Do not modify `src/pages/Admin.jsx`, `src/components/layout/AppRoutes.jsx`, `src/components/layout/Header.jsx`, `src/config/api.config.js`, `.env.production`, `.env.staging`, or `server/workflow-admin/`.
- `preview=student` may only make a view more restrictive; it must never grant visibility.
- Preserve all unrelated URL query parameters when entering or leaving preview.
- Do not add runtime or development dependencies.

---

### Task 1: Add tested student-preview policy helpers

**Files:**
- Create: `src/util/studentPreview.js`
- Create: `src/util/studentPreview.test.js`
- Modify: `package.json`

**Interfaces:**
- Produces: `isStudentPreview(search: string): boolean`
- Produces: `withStudentPreview(search: string, enabled: boolean): string`
- Produces: `canBypassVisibility(isAuthenticated: boolean, studentPreview: boolean): boolean`

- [ ] **Step 1: Add the test command and failing helper tests**

Add `"test": "vitest run"` to `package.json` scripts and create:

```js
import { describe, expect, it } from 'vitest';
import {
  canBypassVisibility,
  isStudentPreview,
  withStudentPreview,
} from './studentPreview';

describe('student preview policy', () => {
  it('recognizes only the explicit student preview value', () => {
    expect(isStudentPreview('?preview=student')).toBe(true);
    expect(isStudentPreview('?preview=staff')).toBe(false);
    expect(isStudentPreview('')).toBe(false);
  });

  it('allows only non-preview authenticated sessions to bypass visibility', () => {
    expect(canBypassVisibility(true, false)).toBe(true);
    expect(canBypassVisibility(true, true)).toBe(false);
    expect(canBypassVisibility(false, false)).toBe(false);
    expect(canBypassVisibility(false, true)).toBe(false);
  });

  it('adds preview without losing existing parameters', () => {
    expect(withStudentPreview('?college=smith&section=01', true))
      .toBe('?college=smith&section=01&preview=student');
  });

  it('removes only preview when exiting', () => {
    expect(withStudentPreview('?college=smith&preview=student&section=01', false))
      .toBe('?college=smith&section=01');
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
npm test -- src/util/studentPreview.test.js
```

Expected: FAIL because `src/util/studentPreview.js` does not exist.

- [ ] **Step 3: Implement the pure helpers**

Create `src/util/studentPreview.js`:

```js
const PREVIEW_PARAM = 'preview';
const STUDENT_PREVIEW_VALUE = 'student';

export const isStudentPreview = (search = '') => {
  return new URLSearchParams(search).get(PREVIEW_PARAM) === STUDENT_PREVIEW_VALUE;
};

export const withStudentPreview = (search = '', enabled) => {
  const params = new URLSearchParams(search);

  if (enabled) {
    params.set(PREVIEW_PARAM, STUDENT_PREVIEW_VALUE);
  } else {
    params.delete(PREVIEW_PARAM);
  }

  const query = params.toString();
  return query ? `?${query}` : '';
};

export const canBypassVisibility = (isAuthenticated, studentPreview) => {
  return Boolean(isAuthenticated && !studentPreview);
};
```

- [ ] **Step 4: Run the helper tests**

Run:

```bash
npm test -- src/util/studentPreview.test.js
```

Expected: 4 tests PASS.

- [ ] **Step 5: Commit the policy helper**

```bash
git add package.json src/util/studentPreview.js src/util/studentPreview.test.js
git commit -m "test: define student preview visibility policy"
```

---

### Task 2: Add preview state and controls to the course page

**Files:**
- Modify: `src/pages/CourseRecords.jsx:1-50, 517-543, 756-843, 1045-1130, 1177-1338`

**Interfaces:**
- Consumes: `isStudentPreview(location.search)`
- Consumes: `withStudentPreview(location.search, enabled)`
- Consumes: `canBypassVisibility(isAuthenticated, studentPreview)`
- Produces: `canBypassResourceVisibility: boolean` passed to record views

- [ ] **Step 1: Import the policy helpers and derive page state**

Import the three helpers from `../util/studentPreview`. Immediately after reading authentication state, derive:

```js
const studentPreview = isStudentPreview(location.search);
const canBypassResourceVisibility = canBypassVisibility(
  isAuthenticated,
  studentPreview
);

const setStudentPreview = useCallback((enabled) => {
  navigate({
    pathname: location.pathname,
    search: withStudentPreview(location.search, enabled),
    hash: location.hash,
  }, { replace: true });
}, [location.hash, location.pathname, location.search, navigate]);
```

- [ ] **Step 2: Replace page-level visibility authority**

Within resource filtering, hidden-resource counts, and the “not currently available” summary, replace visibility uses of `isAuthenticated` with `canBypassResourceVisibility`. Keep `isAuthenticated` only for deciding whether to show staff preview controls.

Update hook dependency arrays accordingly. Do not replace authentication used for unrelated session behavior.

- [ ] **Step 3: Add the preview action and active banner**

Immediately after the course-information block and before the display-mode control (currently between lines 1086 and 1088), render **Preview as student** only when `isAuthenticated && !studentPreview`. When `studentPreview` is true, render:

```jsx
<Alert color="warning" className="d-flex justify-content-between align-items-center">
  <span>
    <strong>Student preview is active.</strong>{' '}
    Resources and links outside their visibility dates are hidden as they are for students.
  </span>
  <Button color="warning" outline onClick={() => setStudentPreview(false)}>
    Exit student preview
  </Button>
</Alert>
```

The enter action calls `setStudentPreview(true)`. Reuse Reactstrap components already imported by the page; add no new package.

- [ ] **Step 4: Pass visibility authority to every record view**

Pass the same prop through every render path:

```jsx
<RecordCard canBypassVisibility={canBypassResourceVisibility} />
<RecordTable canBypassVisibility={canBypassResourceVisibility} />
```

Cover grouped cards, ungrouped cards, split-view physical cards, split-view electronic cards, and the table view. Remove the currently ineffective `isAuthenticated={isAuthenticated}` props passed to `RecordCard`.

- [ ] **Step 5: Run targeted lint**

Run:

```bash
npx eslint src/pages/CourseRecords.jsx src/util/studentPreview.js src/util/studentPreview.test.js
```

Expected: exit 0.

- [ ] **Step 6: Commit the course-page controls**

```bash
git add src/pages/CourseRecords.jsx
git commit -m "feat: add student preview controls"
```

---

### Task 3: Make card and table views honor explicit visibility authority

**Files:**
- Modify: `src/components/page-sections/course-record/RecordCard.jsx:18, 40-56, 171-214, 250, 522-625, 758-899`
- Modify: `src/components/page-sections/course-record/RecordTable.jsx:14, 40-56, 96-224, 355-373, 585-632, 746, 1061-1082`

**Interfaces:**
- Consumes: `canBypassVisibility: boolean` from `CourseRecords`
- Produces: matching resource and link visibility behavior in card and table views

- [ ] **Step 1: Update `RecordCard`**

Add `canBypassVisibility = false` to its props, remove the direct `useAuth` import and hook, and use the prop everywhere the component currently uses `isAuthenticated` for:

- whole-resource visibility;
- primary-link visibility;
- additional-link visibility;
- staff-only visibility date text and popovers;
- decisions to render unavailable resources.

Add `canBypassVisibility: PropTypes.bool` and its default value. Do not change tracking behavior or URLs.

- [ ] **Step 2: Update `RecordTable`**

Add `canBypassVisibility = false` to its props, remove the direct `useAuth` import and hook, and use the prop everywhere the table currently uses `isAuthenticated` for filtering, primary links, additional links, and staff visibility information.

Add `canBypassVisibility: PropTypes.bool` and its default value. Ensure both combined and split table paths use the same authority.

- [ ] **Step 3: Run tests and targeted lint**

Run:

```bash
npm test -- src/util/studentPreview.test.js
npx eslint src/pages/CourseRecords.jsx src/components/page-sections/course-record/RecordCard.jsx src/components/page-sections/course-record/RecordTable.jsx src/util/studentPreview.js src/util/studentPreview.test.js
```

Expected: 4 tests PASS and ESLint exits 0.

- [ ] **Step 4: Build the production artifact**

Run:

```bash
npm run build
```

Expected: Vite completes a production build and writes assets under `/course-reserves/`. Existing bundle-size or Browserslist warnings are acceptable; compilation errors are not.

- [ ] **Step 5: Commit the record-view integration**

```bash
git add src/components/page-sections/course-record/RecordCard.jsx src/components/page-sections/course-record/RecordTable.jsx
git commit -m "fix: enforce student visibility during preview"
```

---

### Task 4: Verify production isolation and the original bug scenario

**Files:**
- No source changes expected
- Record results in the pull-request description

**Interfaces:**
- Consumes: completed hotfix branch
- Produces: release evidence and a go/no-go decision

- [ ] **Step 1: Confirm protected production files are unchanged**

Run:

```bash
git diff --exit-code eacfc14d8fdff51030b989f6fd640c8357d44973 -- \
  .env.production \
  .env.staging \
  src/pages/Admin.jsx \
  src/components/layout/AppRoutes.jsx \
  src/components/layout/Header.jsx \
  src/config/api.config.js \
  server/workflow-admin
```

Expected: no diff and exit 0.

- [ ] **Step 2: Run the complete automated verification**

Run:

```bash
npm test
npm run build
```

Expected: all tests PASS and production build exits 0.

- [ ] **Step 3: Smoke-test visibility in staging or a production-equivalent environment**

Use one course containing:

- a whole electronic resource outside its visibility window;
- a primary link outside its visibility window;
- an additional link outside its visibility window;
- a currently visible resource and link as controls.

Verify this matrix:

| Session/view | Out-of-window content | In-window content | Staff date annotations |
| --- | --- | --- | --- |
| Fully logged out | Hidden | Visible | Hidden |
| Staff, default view | Visible | Visible | Visible |
| Staff, `preview=student` | Hidden | Visible | Hidden |

Repeat in card/table and combined/split views. Enter and exit preview and confirm the course, college, and section remain unchanged.

- [ ] **Step 4: Verify workflow behavior has not regressed**

Using the production build, confirm the Workflow dropdown, workflow-template tab, mention badge, and workflow notification bell remain absent from normal production navigation. Do not treat the already-known direct-URL exposure as part of this hotfix; document it for the separate workflow-hardening issue.

- [ ] **Step 5: Make the release decision**

Proceed only if the logged-out and staff-preview rows match exactly. If the logged-out row exposes an out-of-window resource or link, stop the release and open a separate persistence/normalization hotfix before deploying student preview.

- [ ] **Step 6: Prepare rollback information**

Record production baseline `eacfc14d8fdff51030b989f6fd640c8357d44973` and its previously deployed artifact in the release notes. Because this branch has no schema or API changes, rollback is redeployment of that artifact.
