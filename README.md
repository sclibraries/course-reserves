# Course reserves — shared development source

Audience: this is a candidate for a **public repository, visible to anyone on the internet**. Publication is on hold until the owner explicitly confirms that audience and destination. Use a private repository if collaboration is intended to be restricted.

This snapshot contains all three active applications as ordinary Git files:

| Path | Application |
| --- | --- |
| `apps/admin-web` | React staff/admin frontend |
| `apps/faculty-form` | React faculty reserves form |
| `apps/api` | PHP/Yii backend, controllers, models, migrations and tests |
| `packages/database/schema.sql` | Schema only; no historical application rows |
| `docker-compose.test.yml` | Isolated API/database test environment |

Start new work in `apps/`. This is a development snapshot, not a production release. Internal review records are maintained separately.

## Install and test

See [Docker setup](docs/testing/docker-test-stack.md). Dependencies are installed from each application's lockfile. The stale root npm lockfile is omitted; do not run root `npm install` or `npm ci`. Use the explicit per-app commands:

```bash
npm run install:locked:admin
npm run install:locked:faculty
npm test
npm run build
npm run lint
npm run typecheck
```

Admin dependencies require a privately supplied `FONTAWESOME_NPM_AUTH_TOKEN`. Backend private settings belong in ignored `apps/api/.env`, copied from `.env.example`. Generate independent cookie/JWT signing keys for each environment. Provider credentials, `EBSCO_PROFILE`, and the SpringShare export URL are supplied privately for the integrations that need them. `CORS_ALLOWED_ORIGINS`, `EBSCO_IP_PREFIXES`, and `ADMIN_EMAILS` accept comma-separated values; empty values add no site origins, prefixes, or recipients. `ADMIN_EMAIL` sets the contact recipient. The three configurable controllers retain their local development origins. Development debug modules allow loopback access only. Browser `VITE_*` settings are public and must never contain secrets.

The API Docker image retains PHP 7.2 compatibility and MariaDB 10.3.39 for existing code verification. Supported production runtimes, clean dependency installation and end-to-end release testing remain separate work. The root development Compose file is legacy tooling: it can contact live FOLIO services and is not the isolated test stack.

## Collaboration

Use this branch as the base for new feature branches and send pull requests back to this shared branch. Keep older branches for reference; do not merge their entire histories into this snapshot. Port reviewed changes selectively, then scan them before publication. Do not deploy this snapshot using the old reset/pull script.

See [packaging evidence and limitations](docs/testing/shareable-package.md).
