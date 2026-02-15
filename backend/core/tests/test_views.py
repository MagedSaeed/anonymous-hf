import pytest
from django.test import Client
from django.urls import reverse

from .factories import UserFactory


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
        assert data["hf_api_token"] == ""

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
        assert data["hf_api_token"] == "hf_test_token_123"
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
    def test_delete_account_deactivates_user(self):
        user = UserFactory()
        client = Client()
        client.force_login(user)
        response = client.delete(reverse("delete-account"))
        assert response.status_code == 200
        user.refresh_from_db()
        assert user.is_active is False
