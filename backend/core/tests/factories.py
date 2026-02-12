import factory
from django.contrib.auth import get_user_model

User = get_user_model()


class UserFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = User

    username = factory.Sequence(lambda n: f"testuser{n}")
    email = factory.LazyAttribute(lambda obj: f"{obj.username}@example.com")
    hf_id = factory.Sequence(lambda n: f"hf_id_{n}")
    hf_username = factory.LazyAttribute(lambda obj: obj.username)
    default_expiry_days = 90
    avatar_url = "https://example.com/avatar.png"
