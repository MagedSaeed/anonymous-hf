import pytest
import requests
import responses
from django.test import Client
from django.utils import timezone

from anonymizer.models import ActivityLog, AnonymousRepo
from anonymizer.tests.factories import ActivityLogFactory, AnonymousRepoFactory
from core.tests.factories import UserFactory


@pytest.mark.django_db
def test_activity_log_filter_viewer(authenticated_client, user):
    repo = AnonymousRepoFactory(owner=user)
    ActivityLog.objects.create(anonymous_repo=repo, action="viewed", actor_type="viewer")
    ActivityLog.objects.create(anonymous_repo=repo, action="viewed", actor_type="owner")

    resp = authenticated_client.get(f"/api/repos/{repo.id}/activity/?actor_type=others")
    assert resp.status_code == 200
    actors = {row["actor_type"] for row in resp.json()["results"]}
    assert actors == {"viewer"}


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

    def test_patch_repo_reactivate_expired(self, authenticated_client, user):
        expired_repo = AnonymousRepoFactory(
            owner=user,
            status="expired",
            expires_at=timezone.now() - timezone.timedelta(days=1),
        )
        resp = authenticated_client.patch(
            f"/api/repos/{expired_repo.pk}/",
            data={"expiry_days": 30},
            content_type="application/json",
        )
        assert resp.status_code == 200
        expired_repo.refresh_from_db()
        assert expired_repo.status == "active"
        assert expired_repo.expires_at > timezone.now() + timezone.timedelta(days=29)

    def test_delete_repo_soft_deletes(self, authenticated_client, repo):
        resp = authenticated_client.delete(f"/api/repos/{repo.pk}/")
        assert resp.status_code == 204
        repo.refresh_from_db()
        assert repo.status == "deleted"

    def test_delete_already_deleted_repo_is_noop(self, authenticated_client, user):
        deleted_repo = AnonymousRepoFactory(owner=user, status="deleted")
        resp = authenticated_client.delete(f"/api/repos/{deleted_repo.pk}/")
        assert resp.status_code == 204
        # Repo should still exist in DB (no hard delete)
        deleted_repo.refresh_from_db()
        assert deleted_repo.status == "deleted"


@pytest.mark.django_db
class TestRepoExpireView:
    def test_expire_repo(self, authenticated_client, repo):
        resp = authenticated_client.post(f"/api/repos/{repo.pk}/expire/")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "expired"
        assert data["is_expired"] is True
        repo.refresh_from_db()
        assert repo.status == "expired"
        assert repo.expires_at <= timezone.now()

    def test_expire_creates_activity_log(self, authenticated_client, repo):
        authenticated_client.post(f"/api/repos/{repo.pk}/expire/")
        from anonymizer.models import ActivityLog

        log = ActivityLog.objects.filter(anonymous_repo=repo, action="manually_expired").first()
        assert log is not None
        assert log.actor_type == "owner"

    def test_expire_requires_auth(self, repo):
        client = Client()
        resp = client.post(f"/api/repos/{repo.pk}/expire/")
        assert resp.status_code == 403

    def test_expire_only_owner(self, repo):
        other_user = UserFactory()
        client = Client()
        client.force_login(other_user)
        resp = client.post(f"/api/repos/{repo.pk}/expire/")
        assert resp.status_code == 404

    def test_expire_already_expired_repo(self, authenticated_client, user):
        repo = AnonymousRepoFactory(owner=user, status="expired")
        resp = authenticated_client.post(f"/api/repos/{repo.pk}/expire/")
        assert resp.status_code == 400

    def test_expire_deleted_repo(self, authenticated_client, user):
        repo = AnonymousRepoFactory(owner=user, status="deleted")
        resp = authenticated_client.post(f"/api/repos/{repo.pk}/expire/")
        assert resp.status_code == 400


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


@pytest.mark.django_db
class TestCreateRepoIdentityScan:
    """Creation always returns a findings list; it is advisory, never blocking."""

    README_URL = "https://huggingface.co/datasets/myuser/myrepo/resolve/main/README.md"

    def _create(self, client):
        return client.post(
            "/api/repos/",
            data={"original_url": "https://huggingface.co/datasets/myuser/myrepo"},
            content_type="application/json",
        )

    @responses.activate
    def test_findings_returned_for_arxiv_link(self, authenticated_client):
        responses.add(
            responses.GET,
            self.README_URL,
            body=b"# Paper\nPreprint: https://arxiv.org/abs/2401.12345\n",
            status=200,
        )
        resp = self._create(authenticated_client)
        assert resp.status_code == 201
        findings = resp.json()["identity_findings"]
        assert [f["kind"] for f in findings] == ["arxiv"]
        assert findings[0]["line"] == 2

    @responses.activate
    def test_findings_empty_for_clean_readme(self, authenticated_client):
        responses.add(responses.GET, self.README_URL, body=b"# A dataset\n", status=200)
        resp = self._create(authenticated_client)
        assert resp.status_code == 201
        assert resp.json()["identity_findings"] == []

    @responses.activate
    def test_missing_readme_does_not_block_creation(self, authenticated_client):
        responses.add(responses.GET, self.README_URL, status=404)
        resp = self._create(authenticated_client)
        assert resp.status_code == 201
        assert resp.json()["identity_findings"] == []

    @responses.activate
    def test_huggingface_failure_does_not_block_creation(self, authenticated_client):
        responses.add(responses.GET, self.README_URL, body=requests.RequestException("boom"))
        resp = self._create(authenticated_client)
        assert resp.status_code == 201
        assert resp.json()["identity_findings"] == []


@pytest.mark.django_db
class TestRepoUpdateValidation:
    """Updates are validated like creates; derived fields are not directly writable."""

    @pytest.fixture
    def repo(self, user):
        return AnonymousRepoFactory(
            owner=user,
            original_url="https://huggingface.co/datasets/real/repo",
            repo_type="dataset",
            branch="main",
        )

    def _patch(self, client, repo, payload):
        return client.patch(f"/api/repos/{repo.pk}/", data=payload, content_type="application/json")

    def test_rejects_non_hf_url(self, authenticated_client, repo):
        r = self._patch(authenticated_client, repo, {"original_url": "https://evil.example.com/x"})
        assert r.status_code == 400

    def test_rejects_lookalike_domain(self, authenticated_client, repo):
        r = self._patch(
            authenticated_client, repo, {"original_url": "https://huggingface.co.evil.com/a/b"}
        )
        assert r.status_code == 400

    def test_accepts_valid_hf_url(self, authenticated_client, repo):
        r = self._patch(
            authenticated_client, repo, {"original_url": "https://huggingface.co/datasets/a/b"}
        )
        assert r.status_code == 200

    def test_accepts_hf_co_url(self, authenticated_client, repo):
        r = self._patch(authenticated_client, repo, {"original_url": "https://hf.co/datasets/a/b"})
        assert r.status_code == 200

    def test_repo_type_follows_the_url(self, authenticated_client, repo):
        r = self._patch(authenticated_client, repo, {"original_url": "https://huggingface.co/a/b"})
        assert r.status_code == 200
        repo.refresh_from_db()
        assert repo.repo_type == "model"

    def test_repo_type_is_not_directly_writable(self, authenticated_client, repo):
        self._patch(authenticated_client, repo, {"repo_type": "model"})
        repo.refresh_from_db()
        assert repo.repo_type == "dataset"

    def test_expires_at_is_not_directly_writable(self, authenticated_client, repo):
        before = repo.expires_at
        self._patch(authenticated_client, repo, {"expires_at": "2099-01-01T00:00:00Z"})
        repo.refresh_from_db()
        assert repo.expires_at == before

    def test_rejects_branch_with_parent_segment(self, authenticated_client, repo):
        r = self._patch(authenticated_client, repo, {"branch": "../../.."})
        assert r.status_code == 400

    def test_rejects_blank_branch(self, authenticated_client, repo):
        r = self._patch(authenticated_client, repo, {"branch": "   "})
        assert r.status_code == 400

    def test_accepts_valid_branch(self, authenticated_client, repo):
        r = self._patch(authenticated_client, repo, {"branch": "anon-v2"})
        assert r.status_code == 200
        repo.refresh_from_db()
        assert repo.branch == "anon-v2"

    def test_rejects_non_colab_url(self, authenticated_client, repo):
        r = self._patch(authenticated_client, repo, {"colab_url": "https://evil.example.com/nb"})
        assert r.status_code == 400

    def test_accepts_colab_url(self, authenticated_client, repo):
        url = "https://colab.research.google.com/drive/1a2b3c"
        r = self._patch(authenticated_client, repo, {"colab_url": url})
        assert r.status_code == 200

    def test_accepts_blank_colab_url(self, authenticated_client, repo):
        r = self._patch(authenticated_client, repo, {"colab_url": ""})
        assert r.status_code == 200

    def test_extend_expiry_still_works(self, authenticated_client, repo):
        before = repo.expires_at  # factory default is now + 90 days
        r = self._patch(authenticated_client, repo, {"expiry_days": 120})
        assert r.status_code == 200
        repo.refresh_from_db()
        assert repo.expires_at > before

    def test_restore_still_works(self, authenticated_client, user):
        deleted = AnonymousRepoFactory(owner=user, status="deleted")
        r = self._patch(authenticated_client, deleted, {"status": "active"})
        assert r.status_code == 200
        deleted.refresh_from_db()
        assert deleted.status == "active"

    def test_create_rejects_non_colab_url(self, authenticated_client):
        r = authenticated_client.post(
            "/api/repos/",
            data={
                "original_url": "https://huggingface.co/datasets/a/b",
                "colab_url": "https://evil.example.com/nb",
            },
            content_type="application/json",
        )
        assert r.status_code == 400
