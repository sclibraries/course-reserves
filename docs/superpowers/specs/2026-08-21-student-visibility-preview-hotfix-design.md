# Student Visibility Preview Hotfix Design

**Status:** Approved in conversation on 2026-08-21

**Production baseline:** `eacfc14d8fdff51030b989f6fd640c8357d44973` (`main`)

## Problem

Authenticated staff always bypass resource and link visibility windows on the public course-records page. That behavior lets staff manage and verify future or expired resources, but it also makes the visibility toggles appear ineffective during training.

The hotfix must give staff an accurate student-facing preview without logging them out, changing authentication, changing stored visibility settings, or exposing workflow features that production intentionally keeps out of navigation.

## Goals

- Add a clearly labeled **Preview as student** action for authenticated users on the public course-records page.
- In preview mode, apply the same resource, primary-link, and additional-link visibility decisions used for logged-out visitors.
- Make preview mode unmistakable with a persistent banner and an **Exit student preview** action.
- Preserve the current URL and all unrelated query parameters when entering or leaving preview mode.
- Preserve the current production build mode, authentication, API endpoints, workflow navigation behavior, and backend behavior.

## Non-goals

- Do not change `AuthContext`, authentication cookies, tokens, roles, or permissions.
- Do not change resource visibility values in the database.
- Do not change `VisibilityDates.jsx`, `UnifiedVisibilityControl.jsx`, resource persistence, or backend APIs in this hotfix.
- Do not modify workflow components, routes, polling, environment files, or production feature gates.
- Do not attempt to fix the existing direct-URL workflow exposure in the same branch; track that as a separate production-hardening change.

## Design

### Preview state

The URL query parameter `preview=student` is the source of truth. It survives a refresh, can be exited without losing course-identifying parameters, and is safe if shared: it can only make the view more restrictive.

Only authenticated users see the preview control. If a logged-out user opens a URL containing `preview=student`, normal student restrictions still apply.

### Visibility authority

Authentication and visibility authority must be separate concepts:

```js
const canBypassVisibility = isAuthenticated && !isStudentPreview;
```

`isAuthenticated` continues to describe the real session. `canBypassVisibility` is passed to every visibility decision in `CourseRecords`, `RecordCard`, and `RecordTable`. Preview mode must also suppress staff-only visibility dates and unavailable-link annotations so that the result matches a logged-out view.

The helper that interprets and updates the preview query parameter will live in `src/util/studentPreview.js`. Keeping URL manipulation pure makes it testable without adding a component-testing dependency to this production hotfix.

### User interface

Authenticated users see **Preview as student** near the course-page controls. When enabled, the page displays a warning banner:

> Student preview is active. Resources and links outside their visibility dates are hidden as they are for students.

The banner includes **Exit student preview**. Both actions preserve `college`, `courseListingId`, `id`, `section`, and any future query parameters.

### Failure behavior

Preview has no API dependency. Invalid preview parameter values are ignored. If visibility data is absent, existing visibility behavior remains unchanged.

If a logged-out production smoke test shows that a saved toggle is not honored, release is blocked. That would confirm a separate persistence or normalization defect and must not be hidden by the preview UX.

## Files

- Create `src/util/studentPreview.js` — preview query parsing, query updates, and visibility-bypass calculation.
- Create `src/util/studentPreview.test.js` — pure unit tests for preview semantics and parameter preservation.
- Modify `package.json` — expose the existing Vitest dependency through `npm test`.
- Modify `src/pages/CourseRecords.jsx` — render the control/banner and supply visibility authority.
- Modify `src/components/page-sections/course-record/RecordCard.jsx` — consume explicit visibility authority.
- Modify `src/components/page-sections/course-record/RecordTable.jsx` — consume explicit visibility authority.

## Acceptance criteria

- Logged-in staff default view remains unchanged.
- Logged-in staff student preview matches a logged-out view for whole resources, primary links, and additional links.
- Preview works in card, table, combined, and split views.
- Entering and exiting preview preserves all unrelated query parameters.
- No authentication, backend, workflow, route, environment, or deployment files change.
- Unit tests, targeted lint, and the production Vite build pass.
- A manual smoke test confirms saved visibility settings work while fully logged out before release.

## Rollout and rollback

Build from this hotfix branch using the existing production command, deploy through the current production process, and smoke-test both staff and logged-out sessions. Rollback consists of redeploying the artifact from production baseline `eacfc14d` because this hotfix has no schema, API, or persistent-data changes.
