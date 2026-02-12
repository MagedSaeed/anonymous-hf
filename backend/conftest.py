import pytest
from django.test import Client

from core.tests.factories import UserFactory


@pytest.fixture
def user():
    return UserFactory()


@pytest.fixture
def authenticated_client(user):
    client = Client()
    client.force_login(user)
    return client
