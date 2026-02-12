from django.urls import path

from anonymizer.proxy_views import (
    ProxyDownloadView,
    ProxyFileView,
    ProxyInfoView,
    ProxyTreeView,
)

urlpatterns = [
    path("a/<str:anonymous_id>/info/", ProxyInfoView.as_view(), name="proxy-info"),
    path("a/<str:anonymous_id>/tree/", ProxyTreeView.as_view(), name="proxy-tree-root"),
    path("a/<str:anonymous_id>/tree/<path:path>", ProxyTreeView.as_view(), name="proxy-tree"),
    path(
        "a/<str:anonymous_id>/resolve/<path:file_path>", ProxyFileView.as_view(), name="proxy-file"
    ),
    path("a/<str:anonymous_id>/download/", ProxyDownloadView.as_view(), name="proxy-download"),
]
