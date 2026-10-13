# Course Reserves

Smith College Course Reserves supports faculty requests for course materials, library staff
processing, and student discovery of available reserves.

## Applications

- **`apps/api`** — Yii2 REST API for submissions, staff processing, course records, and external
  discovery services.
- **`apps/admin-web`** — React application for library staff and public student reserve pages.
- **`apps/faculty-form`** — React and TypeScript application for faculty course-material requests.

## Local development

Requirements: Docker with Compose, Node.js and npm for frontend checks, and Git.

Prepare the API environment file, then start the stack:

```sh
cp apps/api/.env.example apps/api/.env
# Set the JWT keys and any service credentials needed for your local work.
docker/start.sh --build
```

The first database boot loads `packages/database/schema.sql` and the synthetic development-user
seed. The schema is used by default. To initialize a new local database from another file, set
`DEV_DB_INIT_SQL` to its path before starting the stack. Existing database volumes are not
re-imported on restart.

The nginx entry point is `http://localhost:8080/course-reserves/`. The admin-web and faculty-form
development servers use ports `5173` and `5174`; the API is available under
`/course-reserves/backend/web/` through nginx.

Run frontend checks from each app directory:

```sh
npm ci --workspaces=false
npm run test
npm run build
```

For admin-web, also run `npm run lint`.

API tests run in an isolated Docker stack (`docker-compose.test.yml`) with a synthetic database.
After installing `apps/api` Composer dependencies, run `docker/test/run-api-tests.sh [project-name]`
from the repository root.

## Licence

Course Reserves is available under the [PolyForm Noncommercial License 1.0.0](LICENSE), which
allows use, changes and sharing for noncommercial purposes as that licence defines them.
Third-party code keeps its own licence; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
