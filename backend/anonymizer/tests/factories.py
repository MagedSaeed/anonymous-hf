import factory
from django.utils import timezone

from anonymizer.models import ActivityLog, AnonymousRepo
from core.tests.factories import UserFactory


class AnonymousRepoFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = AnonymousRepo

    owner = factory.SubFactory(UserFactory)
    repo_type = "dataset"
    original_url = "https://huggingface.co/datasets/testuser/testrepo"
    branch = "main"
    status = "active"
    expires_at = factory.LazyFunction(lambda: timezone.now() + timezone.timedelta(days=90))


class ActivityLogFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = ActivityLog

    anonymous_repo = factory.SubFactory(AnonymousRepoFactory)
    action = "viewed"
