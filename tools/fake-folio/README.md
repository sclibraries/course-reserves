# Fake FOLIO

This Node 22 service supplies synthetic FOLIO search responses to the local Course Reserves stack.
It has no npm dependencies. The control page is available at `/_fake-folio/` when the stack is
started with `docker/start.sh --fake-folio`; it can create courses, change reserves and item status,
and reset the runtime data to `data/seed.json`.

The seed includes these academic terms and registrar periods:

| Term | Dates | AP periods |
|---|---|---|
| Spring 2026 | 2026-01-01 through 2026-05-31 | AP_202601, AP_202602, AP_202603, AP_202604, AP_202605 |
| Fall 2025 | 2025-09-01 through 2025-12-31 | AP_202509, AP_202510, AP_202511, AP_202512 |
| Fall 2026 | 2026-09-01 through 2026-12-31 | AP_202609, AP_202610, AP_202611, AP_202612 |
| Spring 2027 | 2027-01-01 through 2027-05-31 | AP_202701, AP_202702, AP_202703, AP_202704, AP_202705 |

Course ids, item ids and people are synthetic. Runtime edits are stored in the mounted runtime
directory; reset restores the checked-in seed.

The Reuse demo includes Test Faculty A's past TST 101 listing for Spring 2026 with three physical
reserves. The API dev seed adds four electronic resources to the same listing (article, chapter,
website and video), with two in `Week 1` and two ungrouped. A separate past TST 107 listing in Fall
2025 gives the all-past-courses view another course number. Run `php yii dev-seed/test-courses` in
the API container to add the electronic materials; `php yii dev-seed/test-courses --reset` removes
the API demo records and restores the API-078 fixture state.
