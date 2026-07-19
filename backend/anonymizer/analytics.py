from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db.models import Count
from django.db.models.functions import TruncDate
from django.utils import timezone

from anonymizer.models import ActivityLog, AnonymousRepo


def aggregate_dashboard_stats(days: int = 30) -> dict:
    """Compute admin dashboard stats from ActivityLog. All server-side; no
    third parties. Returns a dict consumed by the dashboard template."""
    now = timezone.now()
    since = now - timedelta(days=days)

    status_counts = dict(AnonymousRepo.objects.values_list("status").annotate(n=Count("id")))
    total_owners = AnonymousRepo.objects.values("owner").distinct().count()

    user_model = get_user_model()
    latest_repo_date = (
        AnonymousRepo.objects.order_by("-created_at").values_list("created_at", flat=True).first()
    )
    latest_user_date = (
        user_model.objects.order_by("-date_joined").values_list("date_joined", flat=True).first()
    )

    views = ActivityLog.objects.filter(action="viewed")
    downloads = ActivityLog.objects.filter(action="downloaded")

    per_day = (
        views.filter(timestamp__gte=since)
        .annotate(day=TruncDate("timestamp"))
        .values("day")
        .annotate(n=Count("id"))
    )
    counts_by_day = {row["day"]: row["n"] for row in per_day}

    daily_views = []
    for i in range(days):
        d = (since + timedelta(days=i + 1)).date()
        daily_views.append({"date": d, "count": counts_by_day.get(d, 0)})

    return {
        "total_repos": sum(status_counts.values()),
        "active_repos": status_counts.get("active", 0),
        "expired_repos": status_counts.get("expired", 0),
        "deleted_repos": status_counts.get("deleted", 0),
        "total_owners": total_owners,
        "latest_repo_date": latest_repo_date,
        "latest_user_date": latest_user_date,
        "total_views": views.count(),
        "total_downloads": downloads.count(),
        "owner_views": views.filter(actor_type="owner").count(),
        "viewer_views": views.filter(actor_type="viewer").count(),
        "daily_views": daily_views,
        "max_daily": max((d["count"] for d in daily_views), default=0),
    }
