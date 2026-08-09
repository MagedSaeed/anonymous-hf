from django.utils import timezone
from rest_framework import serializers

from anonymizer.models import ActivityLog, AnonymousRepo
from anonymizer.services.huggingface_client import (
    check_repo_access,
    parse_hf_url,
    validate_colab_url,
    validate_hf_url,
)

# "unknown" is absent on purpose: an HF outage must not block creation.
UNKNOWN_CHECK_MESSAGE = "Could not reach HuggingFace to verify this repository."
# HF answers 401 for missing *and* private repos alike, so "no_access" must
# cover both -- a typo is the far more common cause.
REPO_CHECK_MESSAGES = {
    "not_found": "That repository or branch was not found on HuggingFace. Please double check the repo name.",
    "no_access": (
        "Could not find or access that repository. Please double check the name and revision. "
        "If it is private, add a HuggingFace API token in Settings, or grant the "
        "app access to the organisation."
    ),
}


class AnonymousRepoSerializer(serializers.ModelSerializer):
    days_until_expiry = serializers.SerializerMethodField()
    is_expired = serializers.SerializerMethodField()
    anonymous_url = serializers.CharField(read_only=True)
    visitor_views = serializers.SerializerMethodField()
    visitor_downloads = serializers.SerializerMethodField()

    class Meta:
        model = AnonymousRepo
        fields = [
            "id",
            "repo_type",
            "original_url",
            "branch",
            "anonymous_id",
            "anonymous_url",
            "status",
            "created_at",
            "updated_at",
            "expires_at",
            "visitor_views",
            "visitor_downloads",
            "days_until_expiry",
            "is_expired",
            "colab_url",
        ]
        read_only_fields = [
            "id",
            "anonymous_id",
            "anonymous_url",
            "created_at",
            "updated_at",
            # Derived from original_url; set in update() rather than accepted.
            "repo_type",
            # Driven by the expiry_days parameter so the activity log stays accurate.
            "expires_at",
        ]

    def validate_original_url(self, value):
        is_valid, error = validate_hf_url(value)
        if not is_valid:
            raise serializers.ValidationError(error)
        return value

    def validate_branch(self, value):
        branch = value.strip()
        if not branch:
            raise serializers.ValidationError("Branch is required.")
        if ".." in branch.split("/"):
            raise serializers.ValidationError("Branch cannot contain '..'.")
        return branch

    def validate_colab_url(self, value):
        is_valid, error = validate_colab_url(value)
        if not is_valid:
            raise serializers.ValidationError(error)
        return value

    def update(self, instance, validated_data):
        # Keep repo_type consistent with the URL it is derived from.
        if "original_url" in validated_data:
            parsed = parse_hf_url(validated_data["original_url"])
            if parsed.get("repo_type"):
                validated_data["repo_type"] = parsed["repo_type"]
        return super().update(instance, validated_data)

    def get_days_until_expiry(self, obj):
        if obj.expires_at:
            delta = obj.expires_at - timezone.now()
            return max(0, delta.days)
        return 0

    def get_is_expired(self, obj):
        return obj.status == "expired" or (obj.expires_at and obj.expires_at < timezone.now())

    def get_visitor_views(self, obj):
        return obj.activity_logs.filter(action="viewed").exclude(actor_type="owner").count()

    def get_visitor_downloads(self, obj):
        return obj.activity_logs.filter(action="downloaded").exclude(actor_type="owner").count()


class CreateRepoSerializer(serializers.Serializer):
    original_url = serializers.URLField()
    branch = serializers.CharField(default="main", required=False)
    expiry_days = serializers.IntegerField(min_value=1, max_value=365, required=False)
    colab_url = serializers.URLField(required=False, allow_blank=True, default="")

    def validate_original_url(self, value):
        is_valid, error = validate_hf_url(value)
        if not is_valid:
            raise serializers.ValidationError(error)
        return value

    def validate_colab_url(self, value):
        is_valid, error = validate_colab_url(value)
        if not is_valid:
            raise serializers.ValidationError(error)
        return value

    def validate(self, attrs):
        user = self.context["request"].user
        parsed = parse_hf_url(attrs["original_url"])
        status = check_repo_access(
            parsed.get("repo_id", ""),
            parsed.get("repo_type", "dataset"),
            attrs.get("branch", "main"),
            user.hf_api_token,
        )
        if status in REPO_CHECK_MESSAGES:
            raise serializers.ValidationError({"original_url": REPO_CHECK_MESSAGES[status]})
        return attrs

    def create(self, validated_data):
        user = self.context["request"].user
        url = validated_data["original_url"]
        branch = validated_data.get("branch", "main")
        expiry_days = validated_data.get("expiry_days", user.default_expiry_days)

        parsed = parse_hf_url(url)
        repo_type = parsed.get("repo_type", "dataset")

        repo = AnonymousRepo.objects.create(
            owner=user,
            repo_type=repo_type,
            original_url=url,
            branch=branch,
            expires_at=timezone.now() + timezone.timedelta(days=expiry_days),
            colab_url=validated_data.get("colab_url", ""),
        )
        return repo


class ActivityLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = ActivityLog
        fields = ["id", "action", "actor_type", "timestamp"]
