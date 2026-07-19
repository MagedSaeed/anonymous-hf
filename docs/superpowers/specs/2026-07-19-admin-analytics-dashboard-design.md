# Admin Analytics Dashboard — Design

**Date:** 2026-07-19
**Status:** Approved (pending spec review)

## Problem

We want basic usage analytics for the Anonymous HuggingFace service (how many repos
exist, how many times they're viewed/downloaded, activity over time). Because this is a
double-blind peer-review tool, analytics must never leak reviewer identity or send any
data to a third party.

Third-party analytics (Google Analytics, etc.) are explicitly rejected: they ship URLs,
referrers, and IPs to an external service and would undermine the anonymity guarantee.
The chosen approach is **server-side, first-party analytics** derived from data we already
collect — the same pattern used by the field-standard tool anonymous.4open.science, which
counts views server-side in its own database with no client-side tracking.

## Scope

- **In scope:** a staff-only admin dashboard page showing aggregate stats, plus a data-model
  cleanup and a privacy hardening of the activity log.

## Current state (as-is)

- `ActivityLog` (separate model) already records every meaningful event as its own row:
  `created`, `viewed`, `downloaded`, `extended`, `manually_expired`, `deleted`, `restored`,
  each with an `actor_type` and a `timestamp`. Written on the proxy path
  (`proxy_views.py` — `viewed`, `downloaded`) and in the owner API (`views.py`).
  **This is already our event stream / source of truth.**
- `AnonymousRepo.view_count` and `AnonymousRepo.access_count` are fields on the repo model.
  **Bug:** nothing ever increments them (no `F()` update anywhere) — they are always `0`,
  yet the admin list displays `view_count`, which is misleading.
- `actor_type` currently has three values: `anonymous` (not logged in), `non_owner`
  (logged in, not the owner), `owner`.

## Design decisions

### 1. Single source of truth: `ActivityLog`

All dashboard numbers are derived by aggregating `ActivityLog`. There is no separate
counter bookkeeping to reconcile.

- **Remove** `view_count` and `access_count` from `AnonymousRepo` (schema migration drops
  the columns). This also fixes the always-`0` misleading-column bug by deletion.

### 2. Privacy hardening: collapse `actor_type` to `owner` / `viewer`

The `non_owner` category records that an identifiable, logged-in HuggingFace user viewed a
specific anonymized repo — exactly the linkage a double-blind tool must never create.

- Collapse `anonymous` + `non_owner` into a single `viewer` bucket. A logged-in non-owner
  is treated identically to a truly anonymous visitor; the logged-in-status distinction is
  never recorded.
- `actor_type` becomes two values: `owner`, `viewer`.
- `_get_actor_type()` returns `"owner"` if the request user is the repo owner, else
  `"viewer"`.
- The `ActivityLog` still stores no user FK / identity — only the category label.
- A data migration remaps existing `anonymous` and `non_owner` rows to `viewer`.

Keeping the `owner` vs `viewer` split is intentional and not a privacy concern (the owner is
the account holder viewing their own repo); it lets the dashboard separate owner self-views
from real external/reviewer traffic.

### 3. Views vs downloads

`ActivityLog` already logs both `viewed` and `downloaded` events for free (existing code).
We keep both. The dashboard leads with **views** as the headline metric and shows
**downloads** as a smaller secondary number. No logging is removed.

### 4. Admin dashboard page

- A new staff-only view at `/admin/dashboard/`, reusing Django admin authentication
  (`@staff_member_required`). No new API surface, no React, no third party.
- Registered under the admin namespace (extend `admin.site.get_urls`) and linked from the
  admin index, rendering a template that extends `admin/base_site.html` for consistent
  styling.
- Aggregation is a pure, unit-testable helper function using the ORM (`Count`, `TruncDate`,
  time-window filters).

**Dashboard contents** (all live-aggregated from `ActivityLog` / `AnonymousRepo`):

- **Stat cards:** total repos split by status (active / expired / deleted); total distinct
  owners; total views (headline); total downloads (secondary).
- **30-day activity chart:** views per day for the last 30 days, rendered as an inline SVG
  bar chart (no CDN / no external JS — consistent with the no-external-dependency proxy
  ethos).
- **Actor breakdown:** owner self-views vs viewer (external) views.

Explicitly **not** included: top-N most-viewed repos (dropped per review).

## Components & data flow

```
ActivityLog rows  ──aggregate()──▶  stats dict  ──▶  dashboard.html (cards + SVG chart)
(source of truth)   (ORM Count/                        served at /admin/dashboard/
                     TruncDate)                        (staff_member_required)
```

- `aggregate_dashboard_stats()` — pure function, returns a dict of all numbers/series.
  Independently testable without HTTP.
- `dashboard_view(request)` — thin staff-gated view calling the helper and rendering the
  template.
- `templates/admin/dashboard.html` — presentation only; no data logic.

## Ripple changes (existing code that must be updated)

- `anonymizer/models.py` — remove `view_count`/`access_count`; change `ACTOR_TYPE_CHOICES`
  and default to `owner`/`viewer`.
- `anonymizer/proxy_views.py` — `_get_actor_type()` returns `owner`/`viewer`.
- `anonymizer/views.py` (`ActivityLogListView`, ~L171-175) — filter logic references
  `"anonymous"`/`"non_owner"`/`"others"`; update to `owner`/`viewer`.
- `anonymizer/serializers.py` (L52, L55) — `.exclude(actor_type="owner")` remains correct;
  verify against the new two-value scheme.
- `anonymizer/admin.py` (L24, L29) — drop `view_count`/`access_count` from list/readonly.
- `anonymizer/management/commands/export_repos.py` — **delete the file entirely** (it
  exports the removed columns; not referenced by any cron/script; the dashboard does not
  replace raw CSV export, but the export is not needed).
- `frontend/src/types.ts` (L47) — update `actor_type` union to `'owner' | 'viewer'`; adjust
  any activity-log filter UI that used the old values.

## Migrations

1. Schema migration: drop `AnonymousRepo.view_count` and `AnonymousRepo.access_count`.
2. Schema migration: alter `ActivityLog.actor_type` choices/default.
3. Data migration: remap existing `ActivityLog` rows with `actor_type` in
   (`anonymous`, `non_owner`) → `viewer`.

(May be combined where Django allows; order: remap data before/with tightening choices.)

## Testing

- `_get_actor_type`: authenticated non-owner → `"viewer"`; owner → `"owner"`; anonymous
  request → `"viewer"`.
- Data migration: pre-existing `anonymous`/`non_owner` rows become `viewer`.
- `aggregate_dashboard_stats()`: seeded `ActivityLog` produces correct totals, per-day
  series, and owner-vs-viewer split.
- `dashboard_view`: anonymous request → redirect/403; staff request → 200 with expected
  numbers rendered.
- Confirm `export_repos` command removal doesn't break the test suite / management surface.
