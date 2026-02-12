import pytest
import responses
from django.contrib.auth import get_user_model
from django.test import Client
from django.urls import reverse

User = get_user_model()


@pytest.mark.django_db
class TestHuggingFaceOAuth:
    def test_login_redirects_to_huggingface(self):
        client = Client()
        response = client.get(reverse("hf-login"))
        assert response.status_code == 302
        assert "huggingface.co/oauth/authorize" in response.url
        assert "openid" in response.url
        assert "profile" in response.url

    def test_login_sets_state_in_session(self):
        client = Client()
        client.get(reverse("hf-login"))
        assert "oauth_state" in client.session

    @responses.activate
    def test_callback_creates_user(self):
        # Mock token endpoint
        responses.add(
            responses.POST,
            "https://huggingface.co/oauth/token",
            json={
                "access_token": "hf_oauth_test_token",
                "refresh_token": "hf_refresh_test",
                "expires_in": 28800,
                "token_type": "bearer",
            },
            status=200,
        )
        # Mock userinfo endpoint
        responses.add(
            responses.GET,
            "https://huggingface.co/oauth/userinfo",
            json={
                "sub": "hf_user_123",
                "preferred_username": "testuser",
                "email": "test@example.com",
                "picture": "https://hf.co/avatar.png",
            },
            status=200,
        )

        client = Client()
        # Set up session with state
        session = client.session
        session["oauth_state"] = "test_state"
        session.save()

        response = client.get(
            reverse("hf-callback"),
            {"code": "test_auth_code", "state": "test_state"},
        )
        assert response.status_code == 302
        assert "/app/dashboard" in response.url

        # Verify user was created
        user = User.objects.get(hf_id="hf_user_123")
        assert user.hf_username == "testuser"
        assert user.email == "test@example.com"
        assert user.hf_access_token == "hf_oauth_test_token"

    def test_callback_rejects_invalid_state(self):
        client = Client()
        session = client.session
        session["oauth_state"] = "correct_state"
        session.save()

        response = client.get(
            reverse("hf-callback"),
            {"code": "test_code", "state": "wrong_state"},
        )
        assert response.status_code == 400

    def test_callback_handles_error(self):
        client = Client()
        session = client.session
        session["oauth_state"] = "test_state"
        session.save()

        response = client.get(
            reverse("hf-callback"),
            {"error": "access_denied", "error_description": "User denied", "state": "test_state"},
        )
        assert response.status_code == 400

    @responses.activate
    def test_callback_updates_existing_user(self):
        # Create existing user
        User.objects.create_user(
            username="old_name",
            hf_id="hf_user_123",
            hf_username="old_name",
        )

        responses.add(
            responses.POST,
            "https://huggingface.co/oauth/token",
            json={
                "access_token": "hf_oauth_new_token",
                "refresh_token": "hf_refresh_new",
                "expires_in": 28800,
            },
            status=200,
        )
        responses.add(
            responses.GET,
            "https://huggingface.co/oauth/userinfo",
            json={
                "sub": "hf_user_123",
                "preferred_username": "new_name",
                "email": "new@example.com",
                "picture": "https://hf.co/new_avatar.png",
            },
            status=200,
        )

        client = Client()
        session = client.session
        session["oauth_state"] = "test_state"
        session.save()

        response = client.get(
            reverse("hf-callback"),
            {"code": "test_code", "state": "test_state"},
        )
        assert response.status_code == 302

        # Verify user was updated
        user = User.objects.get(hf_id="hf_user_123")
        assert user.hf_username == "new_name"
        assert user.hf_access_token == "hf_oauth_new_token"
