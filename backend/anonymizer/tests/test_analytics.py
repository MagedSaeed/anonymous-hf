import pytest
from django.test import Client, override_settings
from django.urls import reverse

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
    assert stats["total_users"] == 1
    assert stats["latest_repo_date"] == repo.created_at
    assert stats["latest_user_date"] == owner.date_joined
    assert len(stats["daily_views"]) == 30


@pytest.mark.django_db
def test_aggregate_latest_dates_none_when_empty():
    stats = aggregate_dashboard_stats()
    assert stats["latest_repo_date"] is None


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


@pytest.mark.django_db
def test_dashboard_requires_staff():
    url = reverse("admin:analytics_dashboard")
    non_staff = UserFactory(is_staff=False)
    client = Client()
    client.force_login(non_staff)
    resp = client.get(url)
    assert resp.status_code in (302, 403)


@override_settings(
    STORAGES={
        "staticfiles": {
            "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage",
        },
    }
)
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
    # "View analytics" header link (base_site override) is present.
    assert b"View analytics" in resp.content
