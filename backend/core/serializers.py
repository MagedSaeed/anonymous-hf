from rest_framework import serializers

from .models import User


class UserSerializer(serializers.ModelSerializer):
    has_hf_token = serializers.SerializerMethodField()
    hf_api_token = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "hf_id",
            "hf_username",
            "avatar_url",
            "default_expiry_days",
            "date_joined",
            "has_hf_token",
            "hf_api_token",
        ]
        read_only_fields = [
            "id",
            "username",
            "email",
            "hf_id",
            "hf_username",
            "avatar_url",
            "date_joined",
        ]

    def get_has_hf_token(self, obj):
        return bool(obj.hf_api_token)
