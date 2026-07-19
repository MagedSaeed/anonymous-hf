# Admin Analytics Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a staff-only Django admin analytics dashboard driven entirely by the existing `ActivityLog`, while removing dead view/access counters and hardening reviewer privacy in the activity log.

**Architecture:** `ActivityLog` is the single source of truth; a pure aggregation function computes all numbers, a staff-gated admin view renders them into an `admin/base_site.html` template with inline-SVG charts (no external JS). `actor_type` collapses from three values to two (`owner`/`viewer`) so a logged-in non-owner reviewer is indistinguishable from an anonymous one.

**Tech Stack:** Django 6.0.2, DRF 3.16.1, pytest + Factory Boy (backend); React 19 + TypeScript (frontend). Run backend from `backend/` with `uv run`, frontend from `frontend/` with `npm`.

## Global Constraints

- Backend commands run from `backend/`: `uv run pytest`, `uv run python manage.py ...`, `uv run ruff check .`, `uv run ruff format .`.
- Ruff: line length 100, double quotes, ignore E501.
- Never send data to third parties; all analytics stay in the DB. No client-side tracking scripts.
- `ActivityLog` must never store viewer identity — only the `actor_type` category label.
- Templates rely on Django `APP_DIRS: True` (settings `TEMPLATES.DIRS == []`); put admin templates under `anonymizer/templates/admin/...`.
- Frontend type checking: `npx tsc --noEmit`; build: `npm run build`.
- Do NOT commit — the user will review and make a single commit. Every "Commit" step below is therefore replaced by "stage for review" (`git add`), no `git commit`.

---

### Task 1: Collapse `actor_type` and remove dead counters (model + migrations)

**Files:**
- Modify: `backend/anonymizer/models.py` (ACTOR_TYPE_CHOICES ~L102-104, `actor_type` field ~L111, remove `view_count`/`access_count` ~L36-37)
- Create: `backend/anonymizer/migrations/0012_drop_counters_alter_actor_type.py` (auto-generated)
- Create: `backend/anonymizer/migrations/0013_remap_actor_type_viewer.py` (hand-written data migration)
- Test: `backend/anonymizer/tests/test_models.py`

**Interfaces:**
- Produces: `AnonymousRepo` no longer has `view_count`/`access_count`. `ActivityLog.actor_type` choices are `("owner","Owner")`, `("viewer","Viewer")`, default `"viewer"`.

- [ ] **Step 1: Write the failing test**

Add to `backend/anonymizer/tests/test_models.py`:

```python
import pytest

from anonymizer.models import ActivityLog, AnonymousRepo
from anonymizer.tests.factories import AnonymousRepoFactory


@pytest.mark.django_db
def test_actor_type_choices_are_owner_and_viewer():
    values = {c[0] for c in ActivityLog._meta.get_field("actor_type").choices}
    assert values == {"owner", "viewer"}


@pytest.mark.django_db
def test_actor_type_defaults_to_viewer():
    repo = AnonymousRepoFactory()
    log = ActivityLog.objects.create(anonymous_repo=repo, action="viewed")
    assert log.actor_type == "viewer"


@pytest.mark.django_db
def test_repo_has_no_counter_fields():
    field_names = {f.name for f in AnonymousRepo._meta.get_fields()}
    assert "view_count" not in field_names
    assert "access_count" not in field_names
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest anonymizer/tests/test_models.py -k "actor_type or counter" -v`
Expected: FAIL (choices still include `non_owner`/`anonymous`; counter fields still present).

- [ ] **Step 3: Edit the model**

In `backend/anonymizer/models.py`, delete these two lines from `AnonymousRepo`:

```python
    view_count = models.PositiveIntegerField(default=0)
    access_count = models.PositiveIntegerField(default=0)
```

Replace `ACTOR_TYPE_CHOICES` in `ActivityLog`:

```python
    ACTOR_TYPE_CHOICES = [
        ("viewer", "Viewer"),
        ("owner", "Owner"),
    ]
```

Change the field default:

```python
    actor_type = models.CharField(max_length=10, choices=ACTOR_TYPE_CHOICES, default="viewer")
```

- [ ] **Step 4: Generate the schema migration**

Run: `uv run python manage.py makemigrations anonymizer --name drop_counters_alter_actor_type`
Expected: creates `0012_drop_counters_alter_actor_type.py` with `RemoveField(view_count)`, `RemoveField(access_count)`, `AlterField(actor_type)`.

- [ ] **Step 5: Write the data migration**

Create `backend/anonymizer/migrations/0013_remap_actor_type_viewer.py`:

```python
from django.db import migrations


def remap_forward(apps, schema_editor):
    ActivityLog = apps.get_model("anonymizer", "ActivityLog")
    ActivityLog.objects.filter(actor_type__in=["anonymous", "non_owner"]).update(
        actor_type="viewer"
    )


def remap_backward(apps, schema_editor):
    # Irreversible collapse; leave rows as-is on reverse.
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("anonymizer", "0012_drop_counters_alter_actor_type"),
    ]

    operations = [
        migrations.RunPython(remap_forward, remap_backward),
    ]
```

- [ ] **Step 6: Add a data-migration remap test**

Add to `backend/anonymizer/tests/test_models.py` (choices are not DB-enforced, so legacy values can be inserted directly):

```python
@pytest.mark.django_db
def test_legacy_actor_types_remap_to_viewer():
    repo = AnonymousRepoFactory()
    ActivityLog.objects.create(anonymous_repo=repo, action="viewed", actor_type="anonymous")
    ActivityLog.objects.create(anonymous_repo=repo, action="viewed", actor_type="non_owner")
    # Same query the 0013 data migration runs:
    ActivityLog.objects.filter(actor_type__in=["anonymous", "non_owner"]).update(
        actor_type="viewer"
    )
    assert ActivityLog.objects.filter(actor_type="viewer").count() == 2
    assert ActivityLog.objects.exclude(actor_type__in=["owner", "viewer"]).count() == 0
```

- [ ] **Step 7: Apply migrations and run tests**

Run: `uv run python manage.py migrate anonymizer && uv run pytest anonymizer/tests/test_models.py -v`
Expected: migrations apply cleanly; all tests PASS.

- [ ] **Step 8: Stage for review**

```bash
git add backend/anonymizer/models.py backend/anonymizer/migrations/0012_drop_counters_alter_actor_type.py backend/anonymizer/migrations/0013_remap_actor_type_viewer.py backend/anonymizer/tests/test_models.py
```

---

### Task 2: `_get_actor_type` returns `owner`/`viewer`

**Files:**
- Modify: `backend/anonymizer/proxy_views.py:38-44`
- Test: `backend/anonymizer/tests/test_proxy_views.py`

**Interfaces:**
- Consumes: nothing new.
- Produces: `_get_actor_type(request, repo) -> "owner" | "viewer"`.

- [ ] **Step 1: Write the failing test**

Add to `backend/anonymizer/tests/test_proxy_views.py`:

```python
from types import SimpleNamespace

from anonymizer.proxy_views import _get_actor_type
from anonymizer.tests.factories import AnonymousRepoFactory
from core.tests.factories import UserFactory


@pytest.mark.django_db
def test_actor_type_owner():
    repo = AnonymousRepoFactory()
    request = SimpleNamespace(user=SimpleNamespace(is_authenticated=True))
    request.user = repo.owner
    request.user.is_authenticated = True
    assert _get_actor_type(request, repo) == "owner"


@pytest.mark.django_db
def test_actor_type_authenticated_non_owner_is_viewer():
    repo = AnonymousRepoFactory()
    other = UserFactory()
    other.is_authenticated = True
    request = SimpleNamespace(user=other)
    assert _get_actor_type(request, repo) == "viewer"


@pytest.mark.django_db
def test_actor_type_anonymous_is_viewer():
    repo = AnonymousRepoFactory()
    request = SimpleNamespace(user=SimpleNamespace(is_authenticated=False))
    assert _get_actor_type(request, repo) == "viewer"
```

(Ensure `import pytest` exists at the top of the file.)

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest anonymizer/tests/test_proxy_views.py -k actor_type -v`
Expected: FAIL (non-owner currently returns `"non_owner"`, anonymous returns `"anonymous"`).

- [ ] **Step 3: Edit `_get_actor_type`**

Replace the body in `backend/anonymizer/proxy_views.py`:

```python
def _get_actor_type(request, repo):
    """Determine the actor type. A logged-in non-owner is treated identically
    to an anonymous visitor ("viewer") so reviewer identity is never recorded."""
    if hasattr(request, "user") and request.user.is_authenticated and request.user == repo.owner:
        return "owner"
    return "viewer"
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest anonymizer/tests/test_proxy_views.py -k actor_type -v`
Expected: PASS.

- [ ] **Step 5: Stage for review**

```bash
git add backend/anonymizer/proxy_views.py backend/anonymizer/tests/test_proxy_views.py
```

---

### Task 3: Update DRF activity-log filter; verify serializer

**Files:**
- Modify: `backend/anonymizer/views.py:170-176` (`ActivityLogListView.get_queryset`)
- Verify (no change expected): `backend/anonymizer/serializers.py:51-55`
- Test: `backend/anonymizer/tests/test_views.py`

**Interfaces:**
- Consumes: `actor_type` values `owner`/`viewer`.
- Produces: `?actor_type=others` and `?actor_type=viewer` both filter to `viewer`; `?actor_type=owner` filters to owner.

- [ ] **Step 1: Write the failing test**

Add to `backend/anonymizer/tests/test_views.py`:

```python
@pytest.mark.django_db
def test_activity_log_filter_viewer(authenticated_client, user):
    from anonymizer.models import ActivityLog
    from anonymizer.tests.factories import AnonymousRepoFactory

    repo = AnonymousRepoFactory(owner=user)
    ActivityLog.objects.create(anonymous_repo=repo, action="viewed", actor_type="viewer")
    ActivityLog.objects.create(anonymous_repo=repo, action="viewed", actor_type="owner")

    resp = authenticated_client.get(f"/api/repos/{repo.id}/activity/?actor_type=others")
    assert resp.status_code == 200
    actors = {row["actor_type"] for row in resp.json()["results"]}
    assert actors == {"viewer"}
```

(Confirm the activity URL path against `anonymizer/urls.py`; adjust if it differs from `/api/repos/<id>/activity/`.)

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest anonymizer/tests/test_views.py -k activity_log_filter_viewer -v`
Expected: FAIL (current filter maps `others` → `["anonymous","non_owner"]`, so `viewer` rows are excluded).

- [ ] **Step 3: Edit the queryset filter**

Replace the filter block in `backend/anonymizer/views.py`:

```python
        actor_type = self.request.query_params.get("actor_type")
        if actor_type == "others":
            qs = qs.filter(actor_type="viewer")
        elif actor_type in ("viewer", "owner"):
            qs = qs.filter(actor_type=actor_type)
        return qs
```

- [ ] **Step 4: Verify the serializer needs no change**

Confirm `backend/anonymizer/serializers.py` lines 51-55 use `.exclude(actor_type="owner")` (which still means "viewer" under the new scheme). No edit needed.

- [ ] **Step 5: Run tests**

Run: `uv run pytest anonymizer/tests/test_views.py -v`
Expected: PASS (new test + existing `test.actor_type == "owner"` at ~L197 unaffected).

- [ ] **Step 6: Stage for review**

```bash
git add backend/anonymizer/views.py backend/anonymizer/tests/test_views.py
```

---

### Task 4: Admin cleanup + delete `export_repos`

**Files:**
- Modify: `backend/anonymizer/admin.py:22-29` (remove `view_count`/`access_count`)
- Delete: `backend/anonymizer/management/commands/export_repos.py`
- Test: `backend/anonymizer/tests/test_models.py` (import-safety of admin already covered by Django check)

- [ ] **Step 1: Remove counter columns in admin**

In `backend/anonymizer/admin.py`, drop `"view_count",` from `list_display` (L24) and remove `"view_count", "access_count"` from `readonly_fields` (L29). Result:

```python
    readonly_fields = ("anonymous_id", "created_at", "updated_at")
```

- [ ] **Step 2: Delete the export command**

Run: `git rm backend/anonymizer/management/commands/export_repos.py`

- [ ] **Step 3: Verify Django system checks pass**

Run: `uv run python manage.py check`
Expected: `System check identified no issues`.

- [ ] **Step 4: Run the full backend suite**

Run: `uv run pytest`
Expected: PASS (no test references the deleted command or removed fields; if any do, fix them here).

- [ ] **Step 5: Stage for review**

```bash
git add backend/anonymizer/admin.py backend/anonymizer/management/commands/export_repos.py
```

---

### Task 5: Analytics aggregation helper

**Files:**
- Create: `backend/anonymizer/analytics.py`
- Test: `backend/anonymizer/tests/test_analytics.py`

**Interfaces:**
- Produces: `aggregate_dashboard_stats(days: int = 30) -> dict` with keys:
  `total_repos, active_repos, expired_repos, deleted_repos, total_owners,
  total_views, total_downloads, owner_views, viewer_views,
  daily_views (list of {"date": date, "count": int}, length == days), max_daily`.

- [ ] **Step 1: Write the failing test**

Create `backend/anonymizer/tests/test_analytics.py`:

```python
import pytest

from anonymizer.analytics import aggregate_dashboard_stats
from anonymizer.models import ActivityLog
from anonymizer.tests.factories import AnonymousRepoFactory
from core.tests.factories import UserFactory


@pytest.mark.django_db
def test_aggregate_counts_views_downloads_and_actor_split():
    owner = UserFactory()
    repo = AnonymousRepoFactory(owner=owner)
    ActivityLog.objects.create(anonymous_repo=repo, action="viewed", actor_type="viewer")
    ActivityLog.objects.create(anonymous_repo=repo, action="viewed", actor_type="viewer")
    ActivityLog.objects.create(anonymous_repo=repo, action="viewed", actor_type="owner")
    ActivityLog.objects.create(anonymous_repo=repo, action="downloaded", actor_type="viewer")

    stats = aggregate_dashboard_stats()

    assert stats["total_views"] == 3
    assert stats["viewer_views"] == 2
    assert stats["owner_views"] == 1
    assert stats["total_downloads"] == 1
    assert stats["total_repos"] == 1
    assert stats["active_repos"] == 1
    assert stats["total_owners"] == 1
    assert len(stats["daily_views"]) == 30


@pytest.mark.django_db
def test_aggregate_status_breakdown():
    AnonymousRepoFactory(status="active")
    AnonymousRepoFactory(status="expired")
    AnonymousRepoFactory(status="deleted")
    stats = aggregate_dashboard_stats()
    assert stats["active_repos"] == 1
    assert stats["expired_repos"] == 1
    assert stats["deleted_repos"] == 1
    assert stats["total_repos"] == 3
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest anonymizer/tests/test_analytics.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'anonymizer.analytics'`.

- [ ] **Step 3: Implement the helper**

Create `backend/anonymizer/analytics.py`:

```python
from datetime import timedelta

from django.db.models import Count
from django.db.models.functions import TruncDate
from django.utils import timezone

from anonymizer.models import ActivityLog, AnonymousRepo


def aggregate_dashboard_stats(days: int = 30) -> dict:
    """Compute admin dashboard stats from ActivityLog. All server-side; no
    third parties. Returns a dict consumed by the dashboard template."""
    now = timezone.now()
    since = now - timedelta(days=days)

    status_counts = dict(
        AnonymousRepo.objects.values_list("status").annotate(n=Count("id"))
    )
    total_owners = AnonymousRepo.objects.values("owner").distinct().count()

    views = ActivityLog.objects.filter(action="viewed")
    downloads = ActivityLog.objects.filter(action="downloaded")

    per_day = (
        views.filter(timestamp__gte=since)
        .annotate(day=TruncDate("timestamp"))
        .values("day")
        .annotate(n=Count("id"))
    )
    counts_by_day = {row["day"]: row["n"] for row in per_day}

    daily_views = []
    for i in range(days):
        d = (since + timedelta(days=i + 1)).date()
        daily_views.append({"date": d, "count": counts_by_day.get(d, 0)})

    return {
        "total_repos": sum(status_counts.values()),
        "active_repos": status_counts.get("active", 0),
        "expired_repos": status_counts.get("expired", 0),
        "deleted_repos": status_counts.get("deleted", 0),
        "total_owners": total_owners,
        "total_views": views.count(),
        "total_downloads": downloads.count(),
        "owner_views": views.filter(actor_type="owner").count(),
        "viewer_views": views.filter(actor_type="viewer").count(),
        "daily_views": daily_views,
        "max_daily": max((d["count"] for d in daily_views), default=0),
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest anonymizer/tests/test_analytics.py -v`
Expected: PASS.

- [ ] **Step 5: Lint and stage**

Run: `uv run ruff check anonymizer/analytics.py && uv run ruff format anonymizer/analytics.py`

```bash
git add backend/anonymizer/analytics.py backend/anonymizer/tests/test_analytics.py
```

---

### Task 6: Staff-only admin dashboard view + template + link

**Files:**
- Modify: `backend/anonymizer/admin.py` (add view + register URL at top-level `admin.site`)
- Create: `backend/anonymizer/templates/admin/analytics_dashboard.html`
- Create: `backend/anonymizer/templates/admin/anonymizer/anonymousrepo/change_list.html`
- Test: `backend/anonymizer/tests/test_analytics.py`

**Interfaces:**
- Consumes: `aggregate_dashboard_stats()` from Task 5.
- Produces: URL name `admin:analytics_dashboard` at path `/admin/analytics/`, staff-gated.

- [ ] **Step 1: Write the failing test**

Add to `backend/anonymizer/tests/test_analytics.py`:

```python
from django.test import Client
from django.urls import reverse


@pytest.mark.django_db
def test_dashboard_requires_staff():
    url = reverse("admin:analytics_dashboard")
    non_staff = UserFactory(is_staff=False)
    client = Client()
    client.force_login(non_staff)
    resp = client.get(url)
    assert resp.status_code in (302, 403)


@pytest.mark.django_db
def test_dashboard_renders_for_staff():
    repo = AnonymousRepoFactory()
    ActivityLog.objects.create(anonymous_repo=repo, action="viewed", actor_type="viewer")
    staff = UserFactory(is_staff=True, is_superuser=True)
    client = Client()
    client.force_login(staff)
    resp = client.get(reverse("admin:analytics_dashboard"))
    assert resp.status_code == 200
    assert b"Analytics" in resp.content
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest anonymizer/tests/test_analytics.py -k dashboard -v`
Expected: FAIL with `NoReverseMatch: 'analytics_dashboard'`.

- [ ] **Step 3: Add the view and register the URL**

At the top of `backend/anonymizer/admin.py`, extend imports:

```python
from django.contrib import admin
from django.template.response import TemplateResponse
from django.urls import path
from django.utils.html import format_html

from anonymizer.analytics import aggregate_dashboard_stats
from anonymizer.models import ActivityLog, AnonymousRepo
```

At the bottom of `backend/anonymizer/admin.py`, add:

```python
def analytics_dashboard_view(request):
    context = {
        **admin.site.each_context(request),
        "title": "Analytics Dashboard",
        "stats": aggregate_dashboard_stats(),
    }
    return TemplateResponse(request, "admin/analytics_dashboard.html", context)


_original_admin_get_urls = admin.site.get_urls


def _admin_get_urls_with_analytics():
    custom = [
        path(
            "analytics/",
            admin.site.admin_view(analytics_dashboard_view),
            name="analytics_dashboard",
        ),
    ]
    return custom + _original_admin_get_urls()


admin.site.get_urls = _admin_get_urls_with_analytics
```

- [ ] **Step 4: Create the dashboard template**

Create `backend/anonymizer/templates/admin/analytics_dashboard.html`:

```html
{% extends "admin/base_site.html" %}
{% block content %}
<h1>Analytics Dashboard</h1>

<div style="display:flex;gap:1rem;flex-wrap:wrap;margin:1rem 0;">
  <div style="border:1px solid #ccc;border-radius:8px;padding:1rem;min-width:140px;">
    <div style="font-size:2rem;font-weight:700;">{{ stats.total_views }}</div>
    <div>Total views</div>
  </div>
  <div style="border:1px solid #ccc;border-radius:8px;padding:1rem;min-width:140px;">
    <div style="font-size:1.5rem;font-weight:600;">{{ stats.total_downloads }}</div>
    <div>Total downloads</div>
  </div>
  <div style="border:1px solid #ccc;border-radius:8px;padding:1rem;min-width:140px;">
    <div style="font-size:1.5rem;font-weight:600;">{{ stats.total_repos }}</div>
    <div>Repos ({{ stats.active_repos }} active / {{ stats.expired_repos }} expired / {{ stats.deleted_repos }} deleted)</div>
  </div>
  <div style="border:1px solid #ccc;border-radius:8px;padding:1rem;min-width:140px;">
    <div style="font-size:1.5rem;font-weight:600;">{{ stats.total_owners }}</div>
    <div>Owners</div>
  </div>
</div>

<h2>Views by actor</h2>
<p>External (viewer): <strong>{{ stats.viewer_views }}</strong> &nbsp;·&nbsp; Owner self-views: <strong>{{ stats.owner_views }}</strong></p>

<h2>Views — last 30 days</h2>
<svg width="100%" viewBox="0 0 620 140" preserveAspectRatio="none" style="border:1px solid #eee;">
  {% for d in stats.daily_views %}
    <rect x="{% widthratio forloop.counter0 1 20 %}" y="0"
          width="18"
          height="{% if stats.max_daily %}{% widthratio d.count stats.max_daily 120 %}{% else %}0{% endif %}"
          fill="#fbbf24">
      <title>{{ d.date }}: {{ d.count }}</title>
    </rect>
  {% endfor %}
</svg>
<p style="color:#888;">Peak day: {{ stats.max_daily }} views. All numbers computed server-side from the activity log; nothing leaves this database.</p>
{% endblock %}
```

Note: bars are drawn from the top; if you prefer bottom-anchored bars, that is a cosmetic follow-up. The height uses `widthratio d.count max_daily 120` (0–120px within the 140 viewBox).

- [ ] **Step 5: Add the discoverability link**

Create `backend/anonymizer/templates/admin/anonymizer/anonymousrepo/change_list.html`:

```html
{% extends "admin/change_list.html" %}
{% block object-tools-items %}
  <li><a href="{% url 'admin:analytics_dashboard' %}" class="button">Analytics dashboard</a></li>
  {{ block.super }}
{% endblock %}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `uv run pytest anonymizer/tests/test_analytics.py -k dashboard -v`
Expected: PASS.

- [ ] **Step 7: Manually verify rendering**

Run: `uv run python manage.py runserver` and visit `http://localhost:8000/admin/analytics/` (log in as a superuser). Confirm cards, actor split, and the bar chart render.

- [ ] **Step 8: Lint and stage**

Run: `uv run ruff check anonymizer/admin.py && uv run ruff format anonymizer/admin.py`

```bash
git add backend/anonymizer/admin.py backend/anonymizer/templates/admin/analytics_dashboard.html backend/anonymizer/templates/admin/anonymizer/anonymousrepo/change_list.html backend/anonymizer/tests/test_analytics.py
```

---

### Task 7: Frontend — collapse `actor_type` to `owner`/`viewer`

**Files:**
- Modify: `frontend/src/types.ts:47`
- Modify: `frontend/src/pages/RepoDetails/RepoDetailsPage.tsx:11-28` (`ACTOR_FILTERS` unchanged in value, `actorBadge` cases)
- Test: type check + build (no unit test exists for this component; behavior is display-only)

**Interfaces:**
- Consumes: API now returns `actor_type` ∈ `{owner, viewer}`; `?actor_type=others` still maps server-side to viewer.

- [ ] **Step 1: Update the type union**

In `frontend/src/types.ts`, change line 47:

```ts
  actor_type: 'owner' | 'viewer'
```

- [ ] **Step 2: Update the badge switch**

In `frontend/src/pages/RepoDetails/RepoDetailsPage.tsx`, replace the `actorBadge` function's `anonymous`/`non_owner` cases with a single `viewer` case:

```ts
function actorBadge(actorType: string) {
  switch (actorType) {
    case 'viewer':
      return { color: 'bg-slate-300 dark:bg-slate-600', label: 'Reviewer', textColor: 'text-slate-500 dark:text-slate-400' }
    case 'owner':
      return { color: 'bg-amber-400', label: 'You', textColor: 'text-amber-700 dark:text-amber-400' }
    default:
      return { color: 'bg-slate-300', label: 'Unknown', textColor: 'text-slate-500 dark:text-slate-400' }
  }
}
```

(The `ACTOR_FILTERS` list — `''`/`others`/`owner` — needs no change; `others` is still the server's "not me" filter.)

- [ ] **Step 3: Type check**

Run (from `frontend/`): `npx tsc --noEmit`
Expected: no errors. If any other file references the removed `'anonymous'`/`'non_owner'` union members, fix them (grep: `grep -rn "non_owner\|'anonymous'" src`).

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 5: Stage for review**

```bash
git add frontend/src/types.ts frontend/src/pages/RepoDetails/RepoDetailsPage.tsx
```

---

### Task 8: Full-suite verification

- [ ] **Step 1: Backend suite + lint**

Run (from `backend/`): `uv run pytest && uv run ruff check .`
Expected: all tests PASS; ruff clean.

- [ ] **Step 2: Frontend type check + build**

Run (from `frontend/`): `npx tsc --noEmit && npm run build`
Expected: clean.

- [ ] **Step 3: Report to user for single commit**

Do NOT commit. Summarize staged changes and hand off to the user for their single review commit.
