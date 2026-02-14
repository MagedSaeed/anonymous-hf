from django.urls import path

from anonymizer.views import (
    ActivityLogListView,
    HFRepoListView,
    RepoDetailView,
    RepoExpireView,
    RepoListCreateView,
    RepoSyncLatestView,
)

urlpatterns = [
    path("repos/", RepoListCreateView.as_view(), name="repo-list-create"),
    path("repos/<int:pk>/", RepoDetailView.as_view(), name="repo-detail"),
    path("repos/<int:pk>/expire/", RepoExpireView.as_view(), name="repo-expire"),
    path("repos/<int:pk>/sync-latest/", RepoSyncLatestView.as_view(), name="repo-sync-latest"),
    path("repos/<int:repo_id>/activity/", ActivityLogListView.as_view(), name="repo-activity"),
    path("hf-repos/", HFRepoListView.as_view(), name="hf-repos"),
]
