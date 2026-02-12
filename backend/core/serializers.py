from rest_framework import serializers

from .models import User


class UserSerializer(serializers.ModelSerializer):
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
