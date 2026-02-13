import pytest
import responses
from django.test import Client
from django.utils import timezone

from anonymizer.tests.factories import AnonymousRepoFactory


@pytest.fixture
def active_repo():
    return AnonymousRepoFactory(
        original_url="https://huggingface.co/datasets/testuser/testrepo",
        repo_type="dataset",
        branch="main",
        expires_at=timezone.now() + timezone.timedelta(days=30),
    )


@pytest.fixture
def client():
    return Client()


@pytest.mark.django_db
class TestProxyFileView:
    @responses.activate
    def test_proxy_file_success(self, client, active_repo):
        responses.add(
            responses.GET,
            "https://huggingface.co/datasets/testuser/testrepo/resolve/main/README.md",
            body=b"# Hello World",
            status=200,
            content_type="text/markdown",
        )

        resp = client.get(f"/api/a/{active_repo.anonymous_id}/resolve/README.md")
        assert resp.status_code == 200
        assert b"# Hello World" in b"".join(resp.streaming_content)

    @responses.activate
    def test_proxy_file_streams_content(self, client, active_repo):
        responses.add(
            responses.GET,
            "https://huggingface.co/datasets/testuser/testrepo/resolve/main/data.csv",
            body=b"a,b,c\n1,2,3\n",
            status=200,
            content_type="text/csv",
        )

        resp = client.get(f"/api/a/{active_repo.anonymous_id}/resolve/data.csv")
        assert resp.status_code == 200
        assert resp["Content-Type"] == "text/csv"

    def test_proxy_file_not_found_repo(self, client):
        resp = client.get("/api/a/nonexistent12/resolve/README.md")
        assert resp.status_code == 404

    @responses.activate
    def test_proxy_file_hf_404(self, client, active_repo):
        responses.add(
            responses.GET,
            "https://huggingface.co/datasets/testuser/testrepo/resolve/main/missing.txt",
            status=404,
        )

        resp = client.get(f"/api/a/{active_repo.anonymous_id}/resolve/missing.txt")
        assert resp.status_code == 404

    @responses.activate
    def test_proxy_file_hf_403(self, client, active_repo):
        responses.add(
            responses.GET,
            "https://huggingface.co/datasets/testuser/testrepo/resolve/main/secret.txt",
            status=403,
        )

        resp = client.get(f"/api/a/{active_repo.anonymous_id}/resolve/secret.txt")
        assert resp.status_code == 403

    def test_proxy_expired_repo(self, client):
        repo = AnonymousRepoFactory(
            expires_at=timezone.now() - timezone.timedelta(days=1),
        )
        resp = client.get(f"/api/a/{repo.anonymous_id}/resolve/README.md")
        assert resp.status_code == 404

    def test_proxy_deleted_repo(self, client):
        repo = AnonymousRepoFactory(status="deleted")
        resp = client.get(f"/api/a/{repo.anonymous_id}/resolve/README.md")
        assert resp.status_code == 404

    @responses.activate
    def test_proxy_increments_counters(self, client, active_repo):
        responses.add(
            responses.GET,
            "https://huggingface.co/datasets/testuser/testrepo/resolve/main/README.md",
            body=b"content",
            status=200,
        )

        client.get(f"/api/a/{active_repo.anonymous_id}/resolve/README.md")
        active_repo.refresh_from_db()
        assert active_repo.access_count == 1
        assert active_repo.view_count == 1

    @responses.activate
    def test_proxy_creates_activity_log(self, client, active_repo):
        responses.add(
            responses.GET,
            "https://huggingface.co/datasets/testuser/testrepo/resolve/main/README.md",
            body=b"content",
            status=200,
        )

        client.get(f"/api/a/{active_repo.anonymous_id}/resolve/README.md")
        assert active_repo.activity_logs.filter(action="viewed").count() == 1

    @responses.activate
    def test_proxy_401_retries_without_token(self, client, active_repo):
        """When HF returns 401 with token, retry without token for public repos."""
        responses.add(
            responses.GET,
            "https://huggingface.co/datasets/testuser/testrepo/resolve/main/README.md",
            status=401,
        )
        responses.add(
            responses.GET,
            "https://huggingface.co/datasets/testuser/testrepo/resolve/main/README.md",
            body=b"public content",
            status=200,
        )

        resp = client.get(f"/api/a/{active_repo.anonymous_id}/resolve/README.md")
        assert resp.status_code == 200


@pytest.mark.django_db
class TestProxyTreeView:
    @responses.activate
    def test_tree_root(self, client, active_repo):
        tree_data = [
            {"type": "file", "path": "README.md", "size": 100},
            {"type": "directory", "path": "data"},
        ]
        responses.add(
            responses.GET,
            "https://huggingface.co/api/datasets/testuser/testrepo/tree/main",
            json=tree_data,
            status=200,
        )

        resp = client.get(f"/api/a/{active_repo.anonymous_id}/tree/")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 2

    @responses.activate
    def test_tree_subdirectory(self, client, active_repo):
        tree_data = [{"type": "file", "path": "data/train.csv", "size": 500}]
        responses.add(
            responses.GET,
            "https://huggingface.co/api/datasets/testuser/testrepo/tree/main/data",
            json=tree_data,
            status=200,
        )

        resp = client.get(f"/api/a/{active_repo.anonymous_id}/tree/data")
        assert resp.status_code == 200

    @responses.activate
    def test_tree_not_found(self, client, active_repo):
        responses.add(
            responses.GET,
            "https://huggingface.co/api/datasets/testuser/testrepo/tree/main/nonexistent",
            status=404,
        )

        resp = client.get(f"/api/a/{active_repo.anonymous_id}/tree/nonexistent")
        assert resp.status_code == 404


@pytest.mark.django_db
class TestProxyInfoView:
    def test_info_returns_metadata(self, client, active_repo):
        resp = client.get(f"/api/a/{active_repo.anonymous_id}/info/")
        assert resp.status_code == 200
        data = resp.json()
        assert data["anonymous_id"] == active_repo.anonymous_id
        assert data["repo_type"] == "dataset"
        assert data["status"] == "active"
        assert data["allow_download"] is True

    def test_info_not_found(self, client):
        resp = client.get("/api/a/nonexistent12/info/")
        assert resp.status_code == 404


@pytest.mark.django_db
class TestProxyDownloadView:
    @responses.activate
    def test_download_zip(self, client, active_repo):
        # Mock tree listing
        responses.add(
            responses.GET,
            "https://huggingface.co/api/datasets/testuser/testrepo/tree/main",
            json=[{"type": "file", "path": "README.md", "size": 100}],
            status=200,
        )
        # Mock file download
        responses.add(
            responses.GET,
            "https://huggingface.co/datasets/testuser/testrepo/resolve/main/README.md",
            body=b"# Hello",
            status=200,
        )

        resp = client.get(f"/api/a/{active_repo.anonymous_id}/download/")
        assert resp.status_code == 200
        assert resp["Content-Type"] == "application/zip"
        assert "attachment" in resp["Content-Disposition"]

    def test_download_disabled(self, client):
        repo = AnonymousRepoFactory(
            original_url="https://huggingface.co/datasets/testuser/testrepo",
            allow_download=False,
            expires_at=timezone.now() + timezone.timedelta(days=30),
        )
        resp = client.get(f"/api/a/{repo.anonymous_id}/download/")
        assert resp.status_code == 403


