from django.utils import timezone
from rest_framework import serializers

from anonymizer.models import ActivityLog, AnonymousRepo
from anonymizer.services.huggingface_client import parse_hf_url, validate_hf_url


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
        ]

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
