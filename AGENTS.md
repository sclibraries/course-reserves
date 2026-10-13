# AGENTS.md

Guidance for AI coding agents working in this repository. `CLAUDE.md` imports this file; edit
here, never there.

## What this is

Smith College Libraries **Course Reserves**. It is a monorepo with three deployable apps that carry a
course-reserve request from faculty submission through library-staff processing to the public
course page:

- **`apps/faculty-form`**: faculty-facing app. Faculty sign in, pick a course, build a request
  from reused resources, EBSCO Discovery search results or manual items, and submit it. React 18 +
  **TypeScript**, shadcn/Radix UI, react-hook-form + zod, TanStack Query, Zustand.
- **`apps/admin-web`**: library-staff app (work queue, claim and checklist processing, course
  records, users) **and** the public student course pages (`/course/...`, `/records`, `/search`).
  React 18 + **JSX, not TypeScript**, Reactstrap + Bootstrap 5 + Tailwind, Zustand, react-dnd.
- **`apps/api`**: **Yii2 PHP** REST backend (`yii2-app-basic`). It stores submissions, runs staff
  assignment and checklists, handles communications and mail, and proxies FOLIO/EBSCO lookups.

The two frontends differ on purpose: different users, auth lifecycles, UI libraries and build
artifacts. Don't unify them.

## Compatibility limits (read before writing backend code)

The api must run on **PHP 7.2** and **MariaDB 10.3**. `apps/api/composer.json` pins
`platform.php` to `7.2.24`.

- **No** arrow functions (`fn() =>`); use `function () use ($var) {}`.
- **No** typed properties, union types, `??=`, array spread `[...$arr]`, named arguments, `match`,
  or trailing commas in function calls.
- **No** `str_contains` / `str_starts_with` / `str_ends_with`. Check the Symfony polyfills before
  relying on any PHP 8 function.
- `??`, scalar and return types, nullable types and `list()` with keys are fine.
- SQL and migrations stay within MariaDB 10.3. `JSON` columns and `JSON_OBJECT/ARRAY/EXTRACT/CONTAINS`
  are fine. **Avoid** `JSON_ARRAYAGG`/`JSON_OBJECTAGG` (10.5+) and `JSON_TABLE` (10.6+).
- Existing `resource_data`-style columns are `TEXT`/`LONGTEXT`, with `json_encode/decode` in
  `afterFind`/`beforeSave`. Keep that pattern.
- Dependencies: `composer install`, **never** `composer update`. `composer.lock` is committed.
  Frontends use `npm ci` with each app's lockfile.
- Production runs on case-sensitive Linux. admin-web's `prebuild` runs `check-case`.

## Build and test

Local stack (Docker, from the repo root):

```bash
docker/start.sh              # start all services (keeps existing DB data)
docker/start.sh --fresh      # wipe the dev DB volume and re-import the init SQL
docker/stop.sh
docker/logs.sh [service]
docker/db-shell.sh
```

Full stack via nginx: `http://localhost:8080/course-reserves/`; admin-web dev:
`http://localhost:5173/course-reserves/`; faculty-form dev: `http://localhost:5174/`; DB:
`127.0.0.1:3306`. A new dev DB is initialized from `packages/database/schema.sql` (schema only).
Set `DEV_DB_INIT_SQL` to use a different local SQL file. Real data dumps are never committed.

Isolated test stack: see `docs/testing/docker-test-stack.md`. Use your own Compose project name
(`-p <name>`), and never run tests against the developer's dev database.

Frontends (in `apps/admin-web` or `apps/faculty-form`):

```bash
npm run test       # vitest --run (admin-web: vitest --project unit)
npm run lint
npm run build      # admin-web prebuild runs check-case
npx vitest run src/path/to/file.test.jsx      # one file
```

Icons use the free `@fortawesome/free-solid-svg-icons` set
and `react-icons`. No private registry or token is needed.

api (in `apps/api`, or the backend container):

```bash
./yii migrate                 # apps/api/migrations + packages/database/migrations
vendor/bin/codecept run       # unit + functional
vendor/bin/phpcs              # includes the PHP 7.2 compatibility check
```

## How the code fits together

- **Faculty form → api:** `apps/faculty-form/src/store/` and `handlers/submissionHandlers.ts` →
  `apps/api/controllers/FacultySubmissionController.php`.
- **api → staff workflow:** `SubmissionWorkflowController.php` ↔ admin-web
  `store/submissionWorkflowStore.js` and `services/admin/submissionWorkflowService.js`.
- **Staff workflow → processing:** admin-web `pages/AdminElectronicResources.jsx` and
  `hooks/admin/useCourseVerification.js`.
- **Auth:** REST controllers extend `BaseRestController` (`HttpBearerAuth` → `JwtIdentity`, CORS,
  `options` exempt). Production identity comes from Shibboleth server variables; the local
  dev-auth path (`DevAuthController`, `dev-auth/login`) works only when `YII_ENV=dev`.
- **Routing:** `apps/api/config/web.php` `urlManager`. UUID routes for `faculty-submission/<uuid>`
  sit **above** the generic REST rule. Keep new submission routes there, and mirror their
  `OPTIONS` entries.
- **Staff processing is assignment + checklist:** `SubmissionWorkflowController`,
  `ChecklistController`, `ItemChecklistView`. The workflow-template engine (`WorkflowAdminController`,
  `WorkflowInstance`, `WorkflowStep*`, `AutomationDispatcher`, admin-web `workflow-builder/*`,
  `WorkflowPanel`) is unused. Don't extend it or wire it in.
- **Frontend API config:** each app's `apiClient` uses `VITE_BASE_API_URL` and the `VITE_*_PATH`
  settings. Site-specific api settings (CORS origins, EBSCO profile, admin recipients, keys) come
  from environment variables; see `apps/api/.env.example`.

## Interfaces other systems depend on

Don't change these unless your task explicitly covers it. Report any change in your handoff.

| Interface | Defined in | Who depends on it |
|---|---|---|
| Faculty submission payload (items, folders, dates, cloned metadata, draft vs submit) | `FacultySubmissionController`, faculty-form `store/`, `handlers/` | faculty-form ↔ api |
| Submission identifiers: numeric `submission_id` on staff routes; UUID only on `faculty-submission/<uuid>/*` | `config/web.php`, `SubmissionWorkflowController` | admin-web, faculty-form |
| Workflow → processing context (`offering_id`, `folio_course_listing_id`, item fields), passed as route state to `/admin/electronic/:folioCourseId` | `SubmissionWorkflowController`, `submissionWorkflowService` | admin-web |
| JWT claims, token endpoints (`apps/api/admin/*.php`), role names | token issuers, `JwtIdentity` | both frontends, every authenticated route |
| Faculty course lookup (`course-assignments/*`) | `CourseAssignmentsController` | faculty-form |
| Course offering resolution and linking (`course/link-course-offering`, `create-resource` with `offering_id`, …) | `CourseController` | admin-web |
| Public resource responses (`course/get-merged-resources`, `resources`); never include internal notes | `CourseController`, `ResourceController` | public course pages, faculty-form |
| Communications (faculty UUID routes, staff numeric routes); private messages never reach faculty | `FacultySubmissionController`, `SubmissionWorkflowController` | both frontends |
| Deployed URL paths: `/course-reserves/`, `/course-reserves/backend/web/`, `/course-reserves/backend/admin/`, `/folio/web/` | `docker/nginx/nginx.conf`, server config, frontend `VITE_*` settings | the production server |
| Database schema and migrations | `apps/api/migrations/`, `packages/database/` | everything |

## Public repository rules

This repository is public.

- Commit code, tests, configuration templates and setup or user documentation only. No planning
  notes, tickets, review records or test evidence.
- No credentials, keys, tokens or real `.env` files. Settings come from the environment;
  `.env.example` files list them with empty values.
- No real faculty, student or staff data, names, usernames or email addresses, and no database
  dumps. Fixtures and examples are synthetic (for example `devadmin`, `example.edu`).
- Allowed hostnames: `libtools2.smith.edu` (the public production origin), the campus public IP
  range in `CampusDetection.jsx`, `localhost`, and vendor endpoints (FOLIO, EBSCO). No internal IP
  addresses, private export URLs or personal paths (`/Users/...`).
- Third-party code keeps its licence notices.

## Working rules

- Work on a branch named for your task, in your own worktree. Don't switch the branch of a
  checkout another process runs from. Don't push or merge to `main`.
- Keep to the files your task names. If the task is wrong or incomplete, stop and report.
- Never write to production systems, live mail, FOLIO/EBSCO, or a database you didn't create for
  the task.
- Read before you write: exports, immediate callers, shared utilities. Match the surrounding
  conventions. Change only what the task needs.
- Tests must be able to fail when the business rule changes. "Tests pass" means you ran them
  and none were skipped silently.
- If the same command fails the same way three times, stop and report.
- End with: branch and commit, every command you ran with its result (including failures that
  existed before), deviations from the task, and open questions.
