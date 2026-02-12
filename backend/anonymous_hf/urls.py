"""Root URL configuration for anonymous_hf project."""

from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("accounts/huggingface/", include("core.oauth_urls")),
    path("api/", include("core.urls")),
    path("api/", include("anonymizer.urls")),
    path("", include("anonymizer.proxy_urls")),
]
