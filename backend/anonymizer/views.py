from django.utils import timezone
from rest_framework import generics, status
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from anonymizer.models import ActivityLog, AnonymousRepo
from anonymizer.permissions import IsOwner
from anonymizer.serializers import (
    ActivityLogSerializer,
    AnonymousRepoSerializer,
    CreateRepoSerializer,
)
from anonymizer.services.huggingface_client import get_latest_commit, list_user_repos


class ActivityPagination(PageNumberPagination):
    page_size = 10


class RepoListCreateView(generics.ListCreateAPIView):
    """List user's repos or create a new one."""

    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return CreateRepoSerializer
        return AnonymousRepoSerializer

    def get_queryset(self):
        qs = AnonymousRepo.objects.filter(owner=self.request.user)

        # Filter by status
        repo_status = self.request.query_params.get("status")
        if repo_status:
            qs = qs.filter(status=repo_status)

        # Filter by repo_type
        repo_type = self.request.query_params.get("repo_type")
        if repo_type:
            qs = qs.filter(repo_type=repo_type)

        return qs

    def create(self, request, *args, **kwargs):
        serializer = CreateRepoSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        repo = serializer.save()
        ActivityLog.objects.create(
            anonymous_repo=repo, action="created", actor_type="owner"
        )
        output_serializer = AnonymousRepoSerializer(repo)
        return Response(output_serializer.data, status=status.HTTP_201_CREATED)


class RepoDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Get, update, or delete a single repo."""

    serializer_class = AnonymousRepoSerializer
    permission_classes = [IsAuthenticated, IsOwner]

    def get_queryset(self):
        return AnonymousRepo.objects.filter(owner=self.request.user)

    def perform_update(self, serializer):
        old_status = serializer.instance.status
        # Allow extending expiry via expiry_days parameter
        expiry_days = self.request.data.get("expiry_days")
        if expiry_days:
            instance = serializer.save(
                expires_at=timezone.now() + timezone.timedelta(days=int(expiry_days))
            )
        else:
            instance = serializer.save()
        # Log the extension
        if expiry_days:
            ActivityLog.objects.create(
                anonymous_repo=instance, action="extended", actor_type="owner"
            )
        # Log restore if status changed from deleted to active
        if old_status == "deleted" and instance.status == "active":
            ActivityLog.objects.create(
                anonymous_repo=instance, action="restored", actor_type="owner"
            )

    def perform_destroy(self, instance):
        if instance.status == "deleted":
            # Already soft-deleted — permanently remove from DB
            instance.delete()
        else:
            # First delete — soft-delete
            instance.status = "deleted"
            instance.save(update_fields=["status"])
            ActivityLog.objects.create(
                anonymous_repo=instance, action="deleted", actor_type="owner"
            )


class RepoExpireView(APIView):
    """Manually expire a repo immediately."""

    permission_classes = [IsAuthenticated, IsOwner]

    def post(self, request, pk):
        try:
            repo = AnonymousRepo.objects.get(pk=pk, owner=request.user)
        except AnonymousRepo.DoesNotExist:
            return Response({"error": "Not found"}, status=status.HTTP_404_NOT_FOUND)

        if repo.status != "active":
            return Response(
                {"error": f"Cannot expire a repo with status '{repo.status}'"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        repo.expire()
        ActivityLog.objects.create(
            anonymous_repo=repo, action="manually_expired", actor_type="owner"
        )
        serializer = AnonymousRepoSerializer(repo)
        return Response(serializer.data)


class RepoSyncLatestView(APIView):
    """Update the repo's revision to the latest commit on its current branch."""

    permission_classes = [IsAuthenticated, IsOwner]

    def post(self, request, pk):
        try:
            repo = AnonymousRepo.objects.get(pk=pk, owner=request.user)
        except AnonymousRepo.DoesNotExist:
            return Response({"error": "Not found"}, status=status.HTTP_404_NOT_FOUND)

        token = repo.owner.hf_access_token
        repo_id = repo.get_hf_repo_id()
        if not repo_id:
            return Response(
                {"error": "Invalid repository configuration"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Resolve the default branch (main) to get the latest commit
        sha = get_latest_commit(repo_id, repo.repo_type, "main", token)
        if not sha:
            return Response(
                {"error": "Could not fetch latest commit from HuggingFace"},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        repo.branch = sha
        repo.save(update_fields=["branch"])

        serializer = AnonymousRepoSerializer(repo)
        return Response(serializer.data)


class ActivityLogListView(generics.ListAPIView):
    """List activity logs for a repo."""

    serializer_class = ActivityLogSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = ActivityPagination

    def get_queryset(self):
        repo_id = self.kwargs["repo_id"]
        qs = ActivityLog.objects.filter(
            anonymous_repo_id=repo_id,
            anonymous_repo__owner=self.request.user,
        )
        actor_type = self.request.query_params.get("actor_type")
        if actor_type == "others":
            qs = qs.filter(actor_type__in=["anonymous", "non_owner"])
        elif actor_type in ("anonymous", "non_owner", "owner"):
            qs = qs.filter(actor_type=actor_type)
        return qs


class HFRepoListView(APIView):
    """List the authenticated user's HuggingFace repos."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        if not user.hf_username or not user.hf_access_token:
            return Response(
                {"error": "HuggingFace account not linked or token missing"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Cache in session for 5 minutes
        cache_key = "hf_repos_cache"
        cache_ts_key = "hf_repos_cache_ts"
        cached = request.session.get(cache_key)
        cached_ts = request.session.get(cache_ts_key)
        if cached and cached_ts:
            from django.utils.dateparse import parse_datetime

            age = (timezone.now() - parse_datetime(cached_ts)).total_seconds()
            if age < 300:
                return Response(cached)

        repos = list_user_repos(user.hf_username, user.hf_access_token)
        request.session[cache_key] = repos
        request.session[cache_ts_key] = timezone.now().isoformat()
        return Response(repos)
