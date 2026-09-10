# Isolated API test setup

Requires Docker and local Python 3/PHP for `npm run test:isolation`. Run from the repository root. No application database dump is required.

```bash
cp apps/api/.env.example apps/api/.env
mkdir -p apps/api/runtime apps/api/vendor apps/api/web/assets apps/api/tests/_output
docker build -t course-reserves-test-backend:local docker/php
docker run --rm -v "$PWD/apps/api:/app" course-reserves-test-backend:local composer install --no-interaction --prefer-dist --no-scripts
docker run --rm --network none -v "$PWD/apps/api:/app" course-reserves-test-backend:local php -d register_argc_argv=On vendor/bin/codecept build
npm run test:isolation
docker compose -f docker-compose.test.yml up -d --no-build
docker compose -f docker-compose.test.yml exec -T backend php yii migrate/up --interactive=0
docker compose -f docker-compose.test.yml exec -T backend php yii test-data/seed-faculty-workflow
docker compose -f docker-compose.test.yml exec -T backend php -d register_argc_argv=On vendor/bin/codecept run unit --no-colors
docker compose -f docker-compose.test.yml exec -T backend php -d register_argc_argv=On vendor/bin/codecept run functional --no-colors
```

`--no-scripts` prevents the old Composer installer from writing a cookie key into tracked config. Codeception build generates ignored helper classes. The empty local `.env` and writable directory placeholders must exist before the read-only mounts start. Private `.env` values are masked by synthetic test configuration inside this stack.

The schema imports only into a fresh project volume. Run migrations explicitly; Compose startup does not apply them. The fixture creates synthetic course, faculty and submission records. To stop without deleting data:

```bash
docker compose -f docker-compose.test.yml stop
```

This stack has no host ports, uses an internal network and separate volumes, and refuses non-test database targets. It is for API/DB checks; browser testing requires separate configuration. Do not use `docker/start.sh --fresh` for this workflow.

The schema-only import, migrations and synthetic seed were verified. Verification reused existing Composer dependencies read-only; a clean Composer install and clean FontAwesome-authenticated npm install remain unverified. Existing API/lint/typecheck failures are recorded in [package evidence](shareable-package.md).
