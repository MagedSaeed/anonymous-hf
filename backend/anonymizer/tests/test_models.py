import pytest
from django.utils import timezone

from anonymizer.models import AnonymousRepo, generate_anonymous_id
from anonymizer.tests.factories import ActivityLogFactory, AnonymousRepoFactory


@pytest.mark.django_db
class TestAnonymousRepo:
    def test_create_repo(self):
        repo = AnonymousRepoFactory()
        assert repo.pk is not None
        assert repo.status == "active"
        assert len(repo.anonymous_id) == 12

    def test_anonymous_id_unique(self):
        ids = {generate_anonymous_id() for _ in range(100)}
        assert len(ids) == 100

    def test_str_representation(self):
        repo = AnonymousRepoFactory(repo_type="dataset")
        assert "dataset" in str(repo)
        assert repo.anonymous_id in str(repo)

    def test_anonymous_url_property(self):
        repo = AnonymousRepoFactory()
        assert repo.anonymous_url == f"/a/{repo.anonymous_id}/"

    def test_is_expired_active_repo(self):
        repo = AnonymousRepoFactory(expires_at=timezone.now() + timezone.timedelta(days=30))
        assert not repo.is_expired()

    def test_is_expired_past_expiry(self):
        repo = AnonymousRepoFactory(expires_at=timezone.now() - timezone.timedelta(days=1))
        assert repo.is_expired()
        repo.refresh_from_db()
        assert repo.status == "expired"

    def test_is_expired_already_expired_status(self):
        repo = AnonymousRepoFactory(status="expired")
        assert repo.is_expired()

    def test_extend_expiry(self):
        repo = AnonymousRepoFactory(
            status="expired",
            expires_at=timezone.now() - timezone.timedelta(days=1),
        )
        repo.extend_expiry(30)
        repo.refresh_from_db()
        assert repo.status == "active"
        assert repo.expires_at > timezone.now()

    def test_auto_set_expires_at(self):
        repo = AnonymousRepo(
            owner=AnonymousRepoFactory().owner,
            repo_type="dataset",
            original_url="https://huggingface.co/datasets/user/repo",
        )
        repo.expires_at = None
        repo.save()
        assert repo.expires_at is not None

    def test_get_hf_repo_id(self):
        repo = AnonymousRepoFactory(original_url="https://huggingface.co/datasets/myuser/myrepo")
        assert repo.get_hf_repo_id() == "myuser/myrepo"

    def test_get_proxied_url(self):
        repo = AnonymousRepoFactory(
            original_url="https://huggingface.co/datasets/myuser/myrepo",
            repo_type="dataset",
            branch="anon-branch",
        )
        url = repo.get_proxied_url("README.md")
        assert url == "https://huggingface.co/datasets/myuser/myrepo/resolve/anon-branch/README.md"

    def test_get_proxied_url_no_path(self):
        repo = AnonymousRepoFactory(
            original_url="https://huggingface.co/datasets/myuser/myrepo",
            repo_type="dataset",
            branch="main",
        )
        url = repo.get_proxied_url()
        assert url == "https://huggingface.co/datasets/myuser/myrepo/resolve/main"

    def test_default_ordering(self):
        repo1 = AnonymousRepoFactory()
        repo2 = AnonymousRepoFactory()
        repos = list(AnonymousRepo.objects.all())
        assert repos[0] == repo2
        assert repos[1] == repo1


@pytest.mark.django_db
class TestActivityLog:
    def test_create_activity_log(self):
        log = ActivityLogFactory()
        assert log.pk is not None
        assert log.action == "viewed"

    def test_str_representation(self):
        log = ActivityLogFactory(action="downloaded")
        assert "downloaded" in str(log)
        assert log.anonymous_repo.anonymous_id in str(log)
