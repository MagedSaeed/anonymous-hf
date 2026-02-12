import pytest
from django.contrib.auth import get_user_model

from .factories import UserFactory

User = get_user_model()


@pytest.mark.django_db
class TestUserModel:
    def test_create_user(self):
        user = UserFactory()
        assert user.pk is not None
        assert user.default_expiry_days == 90

    def test_default_expiry_days(self):
        user = UserFactory(default_expiry_days=30)
        assert user.default_expiry_days == 30

    def test_hf_id_unique(self):
        UserFactory(hf_id="unique_id_1")
        with pytest.raises(Exception):
            UserFactory(hf_id="unique_id_1")

    def test_str_returns_hf_username(self):
        user = UserFactory(hf_username="testuser")
        assert str(user) == "testuser"

    def test_str_falls_back_to_username(self):
        user = UserFactory(hf_username="", username="fallback")
        assert str(user) == "fallback"

    def test_hf_fields_blank_by_default(self):
        user = User.objects.create_user(username="basic", password="testpass")
        assert user.hf_id is None
        assert user.hf_username == ""
        assert user.hf_access_token == ""
        assert user.avatar_url == ""
