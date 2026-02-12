import pytest
from django.test import Client
from django.utils import timezone

from anonymizer.models import AnonymousRepo
from anonymizer.tests.factories import ActivityLogFactory, AnonymousRepoFactory
from core.tests.factories import UserFactory


@pytest.fixture
def user():
    return UserFactory()


@pytest.fixture
def authenticated_client(user):
    client = Client()
    client.force_login(user)
    return client


@pytest.fixture
def repo(user):
    return AnonymousRepoFactory(
        owner=user,
        original_url="https://huggingface.co/datasets/testuser/testrepo",
        repo_type="dataset",
    )


@pytest.mark.django_db
class TestRepoListCreateView:
    def test_list_repos_requires_auth(self):
        client = Client()
        resp = client.get("/api/repos/")
        assert resp.status_code == 403

    def test_list_repos_empty(self, authenticated_client):
        resp = authenticated_client.get("/api/repos/")
        assert resp.status_code == 200
        assert resp.json()["results"] == []

    def test_list_repos_returns_own_repos(self, authenticated_client, repo):
        resp = authenticated_client.get("/api/repos/")
        assert resp.status_code == 200
        results = resp.json()["results"]
        assert len(results) == 1
        assert results[0]["anonymous_id"] == repo.anonymous_id

    def test_list_repos_excludes_other_users(self, authenticated_client):
        AnonymousRepoFactory()  # Other user's repo
        resp = authenticated_client.get("/api/repos/")
        assert resp.json()["results"] == []

    def test_list_repos_filter_by_status(self, authenticated_client, user):
        AnonymousRepoFactory(owner=user, status="active")
        AnonymousRepoFactory(owner=user, status="deleted")
        resp = authenticated_client.get("/api/repos/?status=active")
        results = resp.json()["results"]
        assert len(results) == 1
        assert results[0]["status"] == "active"

    def test_list_repos_filter_by_repo_type(self, authenticated_client, user):
        AnonymousRepoFactory(owner=user, repo_type="dataset")
        AnonymousRepoFactory(
            owner=user,
            repo_type="model",
            original_url="https://huggingface.co/testuser/mymodel",
        )
        resp = authenticated_client.get("/api/repos/?repo_type=model")
        results = resp.json()["results"]
        assert len(results) == 1
        assert results[0]["repo_type"] == "model"

    def test_create_repo(self, authenticated_client, user):
        resp = authenticated_client.post(
            "/api/repos/",
            data={
                "original_url": "https://huggingface.co/datasets/myuser/myrepo",
                "branch": "anon-branch",
                "expiry_days": 30,
            },
            content_type="application/json",
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["repo_type"] == "dataset"
        assert data["branch"] == "anon-branch"
        assert len(data["anonymous_id"]) == 12
        assert AnonymousRepo.objects.filter(owner=user).count() == 1

    def test_create_repo_default_branch(self, authenticated_client):
        resp = authenticated_client.post(
            "/api/repos/",
            data={"original_url": "https://huggingface.co/datasets/myuser/myrepo"},
            content_type="application/json",
        )
        assert resp.status_code == 201
        assert resp.json()["branch"] == "main"

    def test_create_repo_invalid_url(self, authenticated_client):
        resp = authenticated_client.post(
            "/api/repos/",
            data={"original_url": "https://github.com/user/repo"},
            content_type="application/json",
        )
        assert resp.status_code == 400

    def test_create_repo_detects_model_type(self, authenticated_client):
        resp = authenticated_client.post(
            "/api/repos/",
            data={"original_url": "https://huggingface.co/myuser/mymodel"},
            content_type="application/json",
        )
        assert resp.status_code == 201
        assert resp.json()["repo_type"] == "model"


@pytest.mark.django_db
class TestRepoDetailView:
    def test_get_repo(self, authenticated_client, repo):
        resp = authenticated_client.get(f"/api/repos/{repo.pk}/")
        assert resp.status_code == 200
        assert resp.json()["anonymous_id"] == repo.anonymous_id

    def test_get_repo_requires_auth(self, repo):
        client = Client()
        resp = client.get(f"/api/repos/{repo.pk}/")
        assert resp.status_code == 403

    def test_get_repo_only_owner(self, repo):
        other_user = UserFactory()
        client = Client()
        client.force_login(other_user)
        resp = client.get(f"/api/repos/{repo.pk}/")
        assert resp.status_code == 404

    def test_patch_repo_extend_expiry(self, authenticated_client, repo):
        resp = authenticated_client.patch(
            f"/api/repos/{repo.pk}/",
            data={"expiry_days": 60},
            content_type="application/json",
        )
        assert resp.status_code == 200
        repo.refresh_from_db()
        assert repo.expires_at > timezone.now() + timezone.timedelta(days=59)

    def test_delete_repo_soft_deletes(self, authenticated_client, repo):
        resp = authenticated_client.delete(f"/api/repos/{repo.pk}/")
        assert resp.status_code == 204
        repo.refresh_from_db()
        assert repo.status == "deleted"


@pytest.mark.django_db
class TestActivityLogListView:
    def test_list_activity(self, authenticated_client, repo):
        ActivityLogFactory(anonymous_repo=repo, action="viewed")
        ActivityLogFactory(anonymous_repo=repo, action="downloaded")
        resp = authenticated_client.get(f"/api/repos/{repo.pk}/activity/")
        assert resp.status_code == 200
        data = resp.json()
        assert data["count"] == 2
        assert len(data["results"]) == 2

    def test_list_activity_requires_auth(self, repo):
        client = Client()
        resp = client.get(f"/api/repos/{repo.pk}/activity/")
        assert resp.status_code == 403

    def test_list_activity_only_owner(self, repo):
        ActivityLogFactory(anonymous_repo=repo)
        other_user = UserFactory()
        client = Client()
        client.force_login(other_user)
        resp = client.get(f"/api/repos/{repo.pk}/activity/")
        assert resp.status_code == 200
        data = resp.json()
        assert data["count"] == 0
        assert len(data["results"]) == 0
