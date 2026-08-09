import pytest
from django.contrib.auth import get_user_model
from django.test import Client
from django.urls import reverse

from anonymizer.models import ActivityLog, AnonymousRepo
from anonymizer.tests.factories import AnonymousRepoFactory

from .factories import UserFactory

User = get_user_model()


@pytest.mark.django_db
class TestCSRFTokenView:
    def test_csrf_token_returns_200(self):
        client = Client()
        response = client.get(reverse("csrf-token"))
        assert response.status_code == 200
        assert "csrftoken" in response.cookies

    def test_csrf_token_no_auth_required(self):
        client = Client()
        response = client.get(reverse("csrf-token"))
        assert response.status_code == 200


@pytest.mark.django_db
class TestHealthCheckView:
    def test_health_check_returns_ok(self):
        client = Client()
        response = client.get(reverse("health"))
        assert response.status_code == 200
        assert response.json() == {"status": "ok"}

    def test_health_check_no_auth_required(self):
        client = Client()
        response = client.get(reverse("health"))
        assert response.status_code == 200


@pytest.mark.django_db
class TestProfileView:
    def test_profile_requires_auth(self):
        client = Client()
        response = client.get(reverse("profile"))
        assert response.status_code == 403

    def test_profile_returns_user_data(self):
        user = UserFactory()
        client = Client()
        client.force_login(user)
        response = client.get(reverse("profile"))
        assert response.status_code == 200
        data = response.json()
        assert data["hf_username"] == user.hf_username
        assert data["email"] == user.email
        assert data["default_expiry_days"] == 90

    def test_profile_patch_updates_expiry(self):
        user = UserFactory()
        client = Client()
        client.force_login(user)
        response = client.patch(
            reverse("profile"),
            data={"default_expiry_days": 30},
            content_type="application/json",
        )
        assert response.status_code == 200
        user.refresh_from_db()
        assert user.default_expiry_days == 30

    def test_profile_returns_has_hf_token_false_by_default(self):
        user = UserFactory()
        client = Client()
        client.force_login(user)
        response = client.get(reverse("profile"))
        assert response.status_code == 200
        data = response.json()
        assert data["has_hf_token"] is False
        assert "hf_api_token" not in data

    def test_profile_patch_sets_hf_api_token(self):
        user = UserFactory()
        client = Client()
        client.force_login(user)
        response = client.patch(
            reverse("profile"),
            data={"hf_api_token": "hf_test_token_123"},
            content_type="application/json",
        )
        assert response.status_code == 200
        data = response.json()
        assert data["has_hf_token"] is True
        user.refresh_from_db()
        assert user.hf_api_token == "hf_test_token_123"

    def test_profile_patch_clears_hf_api_token(self):
        user = UserFactory(hf_api_token="hf_existing_token")
        client = Client()
        client.force_login(user)
        response = client.patch(
            reverse("profile"),
            data={"hf_api_token": ""},
            content_type="application/json",
        )
        assert response.status_code == 200
        assert response.json()["has_hf_token"] is False
        user.refresh_from_db()
        assert user.hf_api_token == ""

    def test_profile_patch_cannot_change_readonly_fields(self):
        user = UserFactory()
        client = Client()
        client.force_login(user)
        original_username = user.username
        response = client.patch(
            reverse("profile"),
            data={"username": "hacked"},
            content_type="application/json",
        )
        assert response.status_code == 200
        user.refresh_from_db()
        assert user.username == original_username


@pytest.mark.django_db
class TestLogoutView:
    def test_logout_redirects(self):
        user = UserFactory()
        client = Client()
        client.force_login(user)
        response = client.get(reverse("hf-logout"))
        assert response.status_code == 302
        assert "/app" in response.url


@pytest.mark.django_db
class TestDeleteAccountView:
    """Deletion is permanent: no row is left holding the user's HF credentials."""

    def test_delete_account_removes_the_user(self):
        user = UserFactory()
        client = Client()
        client.force_login(user)
        response = client.delete(reverse("delete-account"))
        assert response.status_code == 200
        assert not User.objects.filter(pk=user.pk).exists()

    def test_delete_account_removes_owned_repos_and_logs(self):
        user = UserFactory()
        repo = AnonymousRepoFactory(owner=user)
        ActivityLog.objects.create(anonymous_repo=repo, action="viewed", actor_type="viewer")
        client = Client()
        client.force_login(user)
        client.delete(reverse("delete-account"))
        assert not AnonymousRepo.objects.filter(pk=repo.pk).exists()
        assert not ActivityLog.objects.filter(anonymous_repo_id=repo.pk).exists()

    def test_delete_account_leaves_other_users_untouched(self):
        other = UserFactory()
        other_repo = AnonymousRepoFactory(owner=other)
        user = UserFactory()
        client = Client()
        client.force_login(user)
        client.delete(reverse("delete-account"))
        assert User.objects.filter(pk=other.pk).exists()
        assert AnonymousRepo.objects.filter(pk=other_repo.pk).exists()

    def test_delete_account_logs_the_user_out(self):
        user = UserFactory()
        client = Client()
        client.force_login(user)
        client.delete(reverse("delete-account"))
        assert "_auth_user_id" not in client.session

    def test_anonymous_link_404s_after_account_deletion(self):
        user = UserFactory()
        repo = AnonymousRepoFactory(owner=user)
        anonymous_id = repo.anonymous_id
        client = Client()
        client.force_login(user)
        client.delete(reverse("delete-account"))
        assert Client().get(f"/api/a/{anonymous_id}/info/").status_code == 404


@pytest.mark.django_db
class TestProfileTokenView:
    """The HF token is fetched on demand, not shipped with every profile load."""

    def test_profile_omits_hf_api_token(self):
        user = UserFactory(hf_api_token="hf_secret_123")
        client = Client()
        client.force_login(user)
        response = client.get(reverse("profile"))
        assert response.status_code == 200
        data = response.json()
        assert "hf_api_token" not in data
        assert data["has_hf_token"] is True

    def test_token_endpoint_returns_token(self):
        user = UserFactory(hf_api_token="hf_secret_123")
        client = Client()
        client.force_login(user)
        response = client.get(reverse("hf-token"))
        assert response.status_code == 200
        assert response.json()["hf_api_token"] == "hf_secret_123"

    def test_token_endpoint_returns_only_own_token(self):
        UserFactory(hf_api_token="hf_other_users_token")
        user = UserFactory(hf_api_token="hf_my_token")
        client = Client()
        client.force_login(user)
        response = client.get(reverse("hf-token"))
        assert response.json()["hf_api_token"] == "hf_my_token"

    def test_token_endpoint_requires_auth(self):
        client = Client()
        response = client.get(reverse("hf-token"))
        assert response.status_code == 403

    def test_token_endpoint_empty_when_unset(self):
        user = UserFactory(hf_api_token="")
        client = Client()
        client.force_login(user)
        response = client.get(reverse("hf-token"))
        assert response.status_code == 200
        assert response.json()["hf_api_token"] == ""

    def test_token_endpoint_is_not_cached(self):
        user = UserFactory(hf_api_token="hf_secret_123")
        client = Client()
        client.force_login(user)
        response = client.get(reverse("hf-token"))
        assert response["Cache-Control"] == "no-store"
