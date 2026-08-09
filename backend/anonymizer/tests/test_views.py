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

    @responses.activate
    def test_create_repo(self, authenticated_client, user):
        responses.add(
            responses.GET,
            "https://huggingface.co/api/datasets/myuser/myrepo/tree/anon-branch",
            json=[],
            status=200,
        )
        responses.add(
            responses.GET,
            "https://huggingface.co/datasets/myuser/myrepo/resolve/anon-branch/README.md",
            body=b"# hi",
            status=200,
        )
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

    @responses.activate
    def test_create_repo_default_branch(self, authenticated_client):
        responses.add(
            responses.GET,
            "https://huggingface.co/api/datasets/myuser/myrepo/tree/main",
            json=[],
            status=200,
        )
        responses.add(
            responses.GET,
            "https://huggingface.co/datasets/myuser/myrepo/resolve/main/README.md",
            body=b"# hi",
            status=200,
        )
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

    @responses.activate
    def test_create_repo_detects_model_type(self, authenticated_client):
        responses.add(
            responses.GET,
            "https://huggingface.co/api/models/myuser/mymodel/tree/main",
            json=[],
            status=200,
        )
        responses.add(
            responses.GET,
            "https://huggingface.co/myuser/mymodel/resolve/main/README.md",
            body=b"# hi",
            status=200,
        )
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

    def test_permanent_delete_removes_soft_deleted_repo(self, authenticated_client, user):
        deleted_repo = AnonymousRepoFactory(owner=user, status="deleted")
        resp = authenticated_client.delete(f"/api/repos/{deleted_repo.pk}/?permanent=true")
        assert resp.status_code == 204
        assert not AnonymousRepo.objects.filter(pk=deleted_repo.pk).exists()

    def test_permanent_delete_removes_activity_logs(self, authenticated_client, user):
        deleted_repo = AnonymousRepoFactory(owner=user, status="deleted")
        ActivityLogFactory(anonymous_repo=deleted_repo)
        authenticated_client.delete(f"/api/repos/{deleted_repo.pk}/?permanent=true")
        assert not ActivityLog.objects.filter(anonymous_repo_id=deleted_repo.pk).exists()

    def test_permanent_delete_rejects_active_repo(self, authenticated_client, repo):
        resp = authenticated_client.delete(f"/api/repos/{repo.pk}/?permanent=true")
        assert resp.status_code == 400
        repo.refresh_from_db()
        assert repo.status == "active"

    def test_permanent_delete_rejects_expired_repo(self, authenticated_client, user):
        expired_repo = AnonymousRepoFactory(owner=user, status="expired")
        resp = authenticated_client.delete(f"/api/repos/{expired_repo.pk}/?permanent=true")
        assert resp.status_code == 400
        expired_repo.refresh_from_db()
        assert expired_repo.status == "expired"

    def test_permanent_delete_ignores_non_true_value(self, authenticated_client, user):
        deleted_repo = AnonymousRepoFactory(owner=user, status="deleted")
        resp = authenticated_client.delete(f"/api/repos/{deleted_repo.pk}/?permanent=1")
        assert resp.status_code == 204
        assert AnonymousRepo.objects.filter(pk=deleted_repo.pk).exists()

    def test_permanent_delete_only_owner(self, user):
        deleted_repo = AnonymousRepoFactory(owner=user, status="deleted")
        client = Client()
        client.force_login(UserFactory())
        resp = client.delete(f"/api/repos/{deleted_repo.pk}/?permanent=true")
        assert resp.status_code == 404
        assert AnonymousRepo.objects.filter(pk=deleted_repo.pk).exists()


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


@pytest.mark.django_db
class TestHFRepoCheckView:
    """Live feedback while the user is entering a repo."""

    TREE = "https://huggingface.co/api/datasets/user/repo/tree/main"

    def _check(self, client, url="https://huggingface.co/datasets/user/repo", branch="main"):
        return client.get("/api/hf-repo-check/", {"url": url, "branch": branch})

    def test_requires_auth(self):
        assert Client().get("/api/hf-repo-check/").status_code == 403

    @responses.activate
    def test_ok_for_reachable_repo(self, authenticated_client):
        responses.add(responses.GET, self.TREE, json=[], status=200)
        resp = self._check(authenticated_client)
        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"

    @responses.activate
    def test_not_found_has_a_message(self, authenticated_client):
        responses.add(responses.GET, self.TREE, status=404)
        data = self._check(authenticated_client).json()
        assert data["status"] == "not_found"
        assert data["message"]

    @responses.activate
    def test_no_access_mentions_the_token(self, authenticated_client):
        responses.add(responses.GET, self.TREE, status=403)
        data = self._check(authenticated_client).json()
        assert data["status"] == "no_access"
        assert "token" in data["message"].lower()

    @responses.activate
    def test_unknown_when_huggingface_is_down(self, authenticated_client):
        responses.add(responses.GET, self.TREE, body=requests.RequestException("boom"))
        assert self._check(authenticated_client).json()["status"] == "unknown"

    def test_invalid_url_is_reported(self, authenticated_client):
        data = self._check(authenticated_client, url="https://evil.example.com/a/b").json()
        assert data["status"] == "invalid_url"


@pytest.mark.django_db
class TestCreateRepoExistenceCheck:
    """A definite 'no' from HuggingFace blocks creation; uncertainty does not."""

    TREE = "https://huggingface.co/api/datasets/myuser/myrepo/tree/main"
    README = "https://huggingface.co/datasets/myuser/myrepo/resolve/main/README.md"

    def _create(self, client):
        return client.post(
            "/api/repos/",
            data={"original_url": "https://huggingface.co/datasets/myuser/myrepo"},
            content_type="application/json",
        )

    @responses.activate
    def test_blocked_when_repo_does_not_exist(self, authenticated_client):
        responses.add(responses.GET, self.TREE, status=404)
        resp = self._create(authenticated_client)
        assert resp.status_code == 400
        assert AnonymousRepo.objects.count() == 0

    @responses.activate
    def test_blocked_when_not_accessible(self, authenticated_client):
        responses.add(responses.GET, self.TREE, status=403)
        assert self._create(authenticated_client).status_code == 400
        assert AnonymousRepo.objects.count() == 0

    @responses.activate
    def test_allowed_when_huggingface_is_unreachable(self, authenticated_client):
        responses.add(responses.GET, self.TREE, body=requests.RequestException("boom"))
        responses.add(responses.GET, self.README, body=b"# hi", status=200)
        assert self._create(authenticated_client).status_code == 201
        assert AnonymousRepo.objects.count() == 1

    @responses.activate
    def test_allowed_when_repo_exists(self, authenticated_client):
        responses.add(responses.GET, self.TREE, json=[], status=200)
        responses.add(responses.GET, self.README, body=b"# hi", status=200)
        assert self._create(authenticated_client).status_code == 201
