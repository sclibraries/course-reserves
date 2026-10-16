# Fake FOLIO

This Node 22 service supplies synthetic FOLIO search responses to the local Course Reserves stack.
It has no npm dependencies. The control page is available at `/_fake-folio/` when the stack is
started with `docker/start.sh --fake-folio`; it can create courses, change reserves and item status,
and reset the runtime data to `data/seed.json`.

The seed includes these academic terms and registrar periods:

| Term | Dates | AP periods |
|---|---|---|
| Fall 2026 | 2026-09-01 through 2026-12-31 | AP_202609, AP_202610, AP_202611, AP_202612 |
| Spring 2027 | 2027-01-01 through 2027-05-31 | AP_202701, AP_202702, AP_202703, AP_202704, AP_202705 |

Course ids, item ids and people are synthetic. Runtime edits are stored in the mounted runtime
directory; reset restores the checked-in seed.
