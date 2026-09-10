# Public package verification

Task: `.tickets/TASK-public-package-review.md`. September 10, 2026.

## Audience and scope

Potential audience: the entire internet. The candidate is unpublished; the owner must explicitly confirm the public destination or select a private destination before publication. This package is a development snapshot, not a production release.

Both frontends, the active Yii backend, schema, migrations, tests and setup guidance are included. Internal reviews, planning records, diagnostic probes, personal examples, server copies, real environment files, database dumps, generated dependencies and nested repositories are excluded. License attribution is retained. The full internal records remain in the original local checkout.

Site origins, provider profile/IP prefixes, cookie/JWT keys and administrator recipients belong in private environment configuration. Empty configuration adds no site-specific origins/prefixes/recipients. Loopback development origins remain available. Browser configuration is public and must never contain secrets.

## Verification and limits

Configuration and provider-request tests exercise supplied and absent settings without external traffic. Four new tests failed before the corresponding changes and passed afterward. All nine configuration tests and five provider-controller tests pass. Isolation checks: 2 passed. Faculty auth tests: 3 passed, with the existing DOM navigation warning.

Full API unit run: 75 tests, 243 assertions, 1 error, 4 failures, 1 skipped. Functional run: 15 tests, 21 assertions, 4 errors, 2 failures. These retain the existing baseline failures; no clean-suite claim is made. Package scans and a fresh single-branch clone are checked at handoff. The existing API suite has baseline failures and a skipped test; clean dependency installation, browser integration and release qualification remain outstanding. A secret scan is not a security certification.

The candidate is kept as one root commit so excluded files are not reachable through its ancestry. Existing remote branches are unchanged. All credentials for this project are supplied privately through environment configuration and are not part of this branch or its history.

## Repeat the secret scan

Gitleaks is run from a pinned Docker image; a host installation is not required. Run against a fresh single-branch clone, not a checkout sharing unrelated branch history:

```bash
docker run --rm --network none -e GIT_CONFIG_COUNT=1 -e GIT_CONFIG_KEY_0=safe.directory -e GIT_CONFIG_VALUE_0=/scan -v "$PWD:/scan:ro" zricethezav/gitleaks:v8.24.2 git /scan --redact --log-opts=--all
docker run --rm --network none -v "$PWD:/scan:ro" zricethezav/gitleaks:v8.24.2 dir /scan --redact
```

Docker may need to download the scanner image first. No scan exclusions or allowlists are required.
