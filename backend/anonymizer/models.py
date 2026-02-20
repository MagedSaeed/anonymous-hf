import secrets
import string

from django.conf import settings
from django.db import models
from django.utils import timezone


def generate_anonymous_id():
    alphabet = string.ascii_lowercase + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(12))


class AnonymousRepo(models.Model):
    REPO_TYPE_CHOICES = [
        ("dataset", "Dataset"),
        ("model", "Model"),
    ]
    STATUS_CHOICES = [
        ("active", "Active"),
        ("expired", "Expired"),
        ("deleted", "Deleted"),
    ]

    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    repo_type = models.CharField(max_length=10, choices=REPO_TYPE_CHOICES)
    original_url = models.URLField(max_length=500)
    branch = models.CharField(max_length=255, default="main")
    anonymous_id = models.CharField(max_length=12, unique=True, default=generate_anonymous_id)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default="active")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    expires_at = models.DateTimeField()
    view_count = models.PositiveIntegerField(default=0)
    access_count = models.PositiveIntegerField(default=0)

    # Download settings
    allow_download = models.BooleanField(default=True)

    # Optional colab notebook link
    colab_url = models.URLField(max_length=500, blank=True, default="")

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.anonymous_id} ({self.repo_type})"

    def save(self, *args, **kwargs):
        if not self.expires_at:
            self.expires_at = timezone.now() + timezone.timedelta(
                days=self.owner.default_expiry_days
            )
        super().save(*args, **kwargs)

    def is_expired(self):
        if self.status == "expired":
            return True
        if timezone.now() > self.expires_at:
            self.status = "expired"
            self.save(update_fields=["status"])
            return True
        return False

    def expire(self):
        self.status = "expired"
        self.expires_at = timezone.now()
        self.save(update_fields=["status", "expires_at"])

    def extend_expiry(self, days):
        self.expires_at = timezone.now() + timezone.timedelta(days=days)
        self.status = "active"
        self.save(update_fields=["expires_at", "status"])

    @property
    def anonymous_url(self):
        return f"/a/{self.anonymous_id}/"

    def get_hf_repo_id(self):
        """Extract repo_id from the original URL (e.g., 'username/repo-name')."""
        from anonymizer.services.huggingface_client import parse_hf_url

        return parse_hf_url(self.original_url).get("repo_id", "")

    def get_proxied_url(self, file_path=""):
        """Build the HuggingFace resolve URL for proxying."""
        repo_id = self.get_hf_repo_id()
        base = f"https://huggingface.co/{self.repo_type}s/{repo_id}/resolve/{self.branch}"
        if file_path:
            return f"{base}/{file_path}"
        return base


class ActivityLog(models.Model):
    ACTION_CHOICES = [
        ("created", "Created"),
        ("viewed", "Viewed"),
        ("downloaded", "Downloaded"),
        ("extended", "Extended"),
        ("manually_expired", "Manually Expired"),
        ("deleted", "Deleted"),
        ("restored", "Restored"),
    ]
    ACTOR_TYPE_CHOICES = [
        ("anonymous", "Anonymous"),
        ("non_owner", "Authenticated Non-Owner"),
        ("owner", "Owner"),
    ]

    anonymous_repo = models.ForeignKey(
        AnonymousRepo, on_delete=models.CASCADE, related_name="activity_logs"
    )
    action = models.CharField(max_length=20, choices=ACTION_CHOICES)
    actor_type = models.CharField(
        max_length=10, choices=ACTOR_TYPE_CHOICES, default="anonymous"
    )
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-timestamp"]

    def __str__(self):
        return f"{self.action} - {self.anonymous_repo.anonymous_id} at {self.timestamp}"
