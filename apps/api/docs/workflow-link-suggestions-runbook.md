# Workflow link suggestions runbook

Run the full link-suggestion sweep hourly from `apps/api`:

```sh
php yii workflow/check-links
```

The command checks unlinked submissions oldest first. `--limit=100` caps a run when the queue needs
to be drained in batches. A FOLIO error preserves the last successful suggestion, records
`last_error_at`, and makes the command exit nonzero if any check failed.

The staff Needs linking endpoint queues up to `LINK_SUGGESTION_REFRESH_LIMIT` stale submissions per
request without calling FOLIO in the web request. A suggestion is stale when it has never been
checked or its last successful check is at least `LINK_SUGGESTION_STALE_MINUTES` old. Defaults are
10 submissions and 10 minutes. Run the queue drain every minute so an open list refreshes promptly:

```sh
php yii workflow/check-links --queuedOnly=1 --limit=10
```

The response page size is controlled by `LINK_SUGGESTION_PAGE_SIZE` (default 20). These settings
are in `apps/api/.env.example`. Changed suggestion results write a `suggested` or `rechecked`
workflow event; identical results do not add hourly events.
