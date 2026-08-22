# Task 1 report: student-preview policy helpers

## What changed

- Added the `test` script (`vitest run`) to `package.json`.
- Added `src/util/studentPreview.js` with `isStudentPreview`, `withStudentPreview`, and `canBypassVisibility`.
- Added four focused tests in `src/util/studentPreview.test.js` covering explicit preview recognition, authenticated bypass policy, parameter-preserving enablement, and preview removal.

## Files changed

- `package.json`
- `src/util/studentPreview.js`
- `src/util/studentPreview.test.js`

## RED evidence

Command (after adding the prescribed test and test script, before implementing the helper):

```text
npm test -- src/util/studentPreview.test.js
```

The repository's existing `vitest.workspace.js` attempted to load a Storybook configuration absent from this worktree and failed first with `SB_CORE-SERVER_0006`. To capture the planned missing-module RED result, the workspace file was temporarily moved aside (then restored), and the same command produced:

```text
Error: Failed to load url ./studentPreview (resolved id: ./studentPreview) in .../src/util/studentPreview.test.js. Does the file exist?
Test Files  1 failed (1)
Tests  no tests
exit_code=1
```

## GREEN evidence

Command:

```text
npm test -- src/util/studentPreview.test.js
```

With the pre-existing Storybook workspace file temporarily moved aside (and restored immediately after the run):

```text
✓ src/util/studentPreview.test.js (4 tests) 1ms
Test Files  1 passed (1)
Tests  4 passed (4)
exit_code=0
```

## Self-review

The implementation matches the brief exactly: URLSearchParams handles query parsing/encoding, enabling sets the explicit `preview=student` value while retaining other parameters, disabling deletes only the preview key, and visibility bypass requires authentication without student preview. No dependencies or unrelated files were changed.

## Concerns

The worktree's existing Vitest workspace references `.storybook`, which is absent here; an unmodified `npm test -- src/util/studentPreview.test.js` therefore fails with Storybook `SB_CORE-SERVER_0006` before running tests. The helper test result above was obtained using the same command with only that workspace file temporarily moved aside.
