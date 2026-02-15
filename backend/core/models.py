from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    """Custom User model with HuggingFace OAuth fields."""

    hf_id = models.CharField(max_length=255, unique=True, null=True, blank=True)
    hf_username = models.CharField(max_length=255, blank=True, default="")
    hf_access_token = models.TextField(blank=True, default="")
    hf_refresh_token = models.TextField(blank=True, default="")
    hf_token_expires_at = models.DateTimeField(null=True, blank=True)
    hf_api_token = models.TextField(blank=True, default="")
    default_expiry_days = models.PositiveIntegerField(default=90)
    avatar_url = models.URLField(max_length=500, blank=True, default="")

    def __str__(self):
        return self.hf_username or self.username
