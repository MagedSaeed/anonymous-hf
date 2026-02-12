from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = (
        "username",
        "email",
        "hf_username",
        "default_expiry_days",
        "is_active",
        "date_joined",
    )
    list_filter = ("is_active", "is_staff", "date_joined")
    search_fields = ("username", "email", "hf_username", "hf_id")

    fieldsets = BaseUserAdmin.fieldsets + (
        (
            "HuggingFace",
            {
                "fields": (
                    "hf_id",
                    "hf_username",
                    "avatar_url",
                    "hf_token_expires_at",
                ),
            },
        ),
        (
            "Preferences",
            {
                "fields": ("default_expiry_days",),
            },
        ),
    )
