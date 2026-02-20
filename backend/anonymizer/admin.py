from django.contrib import admin
from django.utils.html import format_html

from anonymizer.models import ActivityLog, AnonymousRepo


class ActivityLogInline(admin.TabularInline):
    model = ActivityLog
    extra = 0
    readonly_fields = ("action", "timestamp")
    can_delete = False


@admin.register(AnonymousRepo)
class AnonymousRepoAdmin(admin.ModelAdmin):
    list_display = (
        "anonymous_id",
        "repo_type",
        "original_url",
        "branch",
        "colored_status",
        "owner",
        "expires_at",
        "view_count",
        "created_at",
    )
    list_filter = ("repo_type", "status", "created_at", "expires_at")
    search_fields = ("anonymous_id", "original_url", "owner__email", "owner__hf_username")
    readonly_fields = ("anonymous_id", "created_at", "updated_at", "view_count", "access_count")
    inlines = [ActivityLogInline]
    actions = ["extend_expiry_30_days", "mark_as_deleted"]

    @admin.display(description="Status")
    def colored_status(self, obj):
        colors = {
            "active": "#22c55e",
            "expired": "#6b7280",
            "deleted": "#ef4444",
        }
        color = colors.get(obj.status, "#6b7280")
        return format_html(
            '<span style="color: {}; font-weight: bold;">{}</span>', color, obj.get_status_display()
        )

    @admin.action(description="Extend expiry by 30 days")
    def extend_expiry_30_days(self, request, queryset):
        for repo in queryset:
            repo.extend_expiry(30)
        self.message_user(request, f"Extended expiry for {queryset.count()} repos.")

    @admin.action(description="Mark as deleted")
    def mark_as_deleted(self, request, queryset):
        queryset.update(status="deleted")
        self.message_user(request, f"Marked {queryset.count()} repos as deleted.")


@admin.register(ActivityLog)
class ActivityLogAdmin(admin.ModelAdmin):
    list_display = ("timestamp", "action", "anonymous_repo")
    list_filter = ("action", "timestamp")
    readonly_fields = ("anonymous_repo", "action", "timestamp")

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


