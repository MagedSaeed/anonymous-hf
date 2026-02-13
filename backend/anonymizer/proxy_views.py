import io
import zipfile

import requests as http_requests
from django.conf import settings
from django.http import Http404, HttpResponse, JsonResponse, StreamingHttpResponse
from django.views import View

from anonymizer.models import ActivityLog, AnonymousRepo
from anonymizer.services.huggingface_client import (
    build_resolve_url,
    get_tree,
)

CHUNK_SIZE = 8192
PROXY_HEADERS = ["Content-Type", "Content-Length", "Content-Disposition", "ETag", "Last-Modified"]


def get_repo_or_404(anonymous_id):
    """Look up an active anonymous repo or raise 404."""
    try:
        repo = AnonymousRepo.objects.select_related("owner").get(anonymous_id=anonymous_id)
    except AnonymousRepo.DoesNotExist:
        raise Http404("Anonymous repository not found")

    if repo.is_expired():
        raise Http404("This anonymous repository has expired")

    if repo.status == "deleted":
        raise Http404("This anonymous repository has been deleted")

    return repo


def _get_actor_type(request, repo):
    """Determine the actor type based on the request user."""
    if hasattr(request, "user") and request.user.is_authenticated:
        if request.user == repo.owner:
            return "owner"
        return "non_owner"
    return "anonymous"


def log_access(repo, action, request):
    """Create an activity log entry."""
    ActivityLog.objects.create(
        anonymous_repo=repo,
        action=action,
        actor_type=_get_actor_type(request, repo),
    )


def get_hf_token(repo):
    """Get the appropriate HF token for making requests.

    Priority: owner's OAuth token -> platform token from settings.
    """
    owner = repo.owner
    if owner.hf_access_token:
        return owner.hf_access_token
    if settings.HUGGINGFACE_TOKEN:
        return settings.HUGGINGFACE_TOKEN
    return None


class ProxyFileView(View):
    """Proxy a file from HuggingFace, streaming the response."""

    def get(self, request, anonymous_id, file_path=""):
        repo = get_repo_or_404(anonymous_id)

        repo_id = repo.get_hf_repo_id()
        if not repo_id:
            return HttpResponse("Invalid repository configuration", status=500)

        hf_url = build_resolve_url(repo_id, repo.repo_type, repo.branch, file_path)
        token = get_hf_token(repo)

        headers = {}
        if token:
            headers["Authorization"] = f"Bearer {token}"

        try:
            hf_response = http_requests.get(hf_url, headers=headers, stream=True, timeout=30)
        except http_requests.RequestException:
            return HttpResponse("Failed to connect to HuggingFace", status=502)

        if hf_response.status_code == 404:
            raise Http404("File not found")
        if hf_response.status_code == 403:
            return HttpResponse("Access denied by HuggingFace", status=403)
        if hf_response.status_code == 401:
            # Try again without token (public repo)
            hf_response_public = http_requests.get(hf_url, stream=True, timeout=30)
            if hf_response_public.status_code == 200:
                hf_response = hf_response_public
            else:
                return HttpResponse("Access denied by HuggingFace", status=401)
        if hf_response.status_code != 200:
            return HttpResponse(
                f"HuggingFace returned status {hf_response.status_code}",
                status=hf_response.status_code,
            )

        # Log access
        log_access(repo, "viewed", request)

        # Stream the response
        response = StreamingHttpResponse(
            hf_response.iter_content(chunk_size=CHUNK_SIZE),
            status=200,
        )

        # Copy relevant headers
        for header in PROXY_HEADERS:
            value = hf_response.headers.get(header)
            if value:
                response[header] = value

        return response


class ProxyTreeView(View):
    """Proxy the directory tree listing from HuggingFace API."""

    def get(self, request, anonymous_id, path=""):
        repo = get_repo_or_404(anonymous_id)

        repo_id = repo.get_hf_repo_id()
        if not repo_id:
            return HttpResponse("Invalid repository configuration", status=500)

        token = get_hf_token(repo)
        tree = get_tree(repo_id, repo.repo_type, repo.branch, path, token)

        if tree is None:
            raise Http404("Directory not found")

        # Log access
        log_access(repo, "viewed", request)

        return JsonResponse(tree, safe=False)


class ProxyInfoView(View):
    """Return basic anonymous repo metadata.

    For expired repos, reveals the original HuggingFace URL so reviewers
    can find the real identity after the review period is over.
    """

    def get(self, request, anonymous_id):
        try:
            repo = AnonymousRepo.objects.get(anonymous_id=anonymous_id)
        except AnonymousRepo.DoesNotExist:
            raise Http404("Anonymous repository not found")

        if repo.status == "deleted":
            raise Http404("This anonymous repository has been deleted")

        # Check expiry (updates status if needed)
        expired = repo.is_expired()

        data = {
            "anonymous_id": repo.anonymous_id,
            "repo_type": repo.repo_type,
            "branch": repo.branch,
            "status": repo.status,
            "created_at": repo.created_at.isoformat(),
            "expires_at": repo.expires_at.isoformat(),
            "allow_download": repo.allow_download,
            "colab_url": repo.colab_url,
        }

        if expired:
            data["identity_revealed"] = True
            data["original_url"] = repo.original_url

        return JsonResponse(data)


class _ZipStreamBuffer:
    """File-like buffer for streaming ZIP generation.

    Tracks total virtual position so ZipFile records correct header offsets,
    while allowing us to drain written bytes between files.
    """

    def __init__(self):
        self._buffer = io.BytesIO()
        self._total_written = 0

    def write(self, data):
        return self._buffer.write(data)

    def tell(self):
        return self._total_written + self._buffer.tell()

    def flush(self):
        pass

    def drain(self):
        """Return accumulated bytes and reset the internal buffer."""
        self._buffer.seek(0)
        data = self._buffer.read()
        self._total_written += len(data)
        self._buffer.seek(0)
        self._buffer.truncate()
        return data


class ProxyDownloadView(View):
    """Download the entire repo as a streaming ZIP archive.

    Files are downloaded one at a time and streamed into the ZIP,
    so only one file is held in memory at a time.
    """

    def get(self, request, anonymous_id):
        repo = get_repo_or_404(anonymous_id)

        if not repo.allow_download:
            return HttpResponse("Downloads are disabled for this repository", status=403)

        repo_id = repo.get_hf_repo_id()
        if not repo_id:
            return HttpResponse("Invalid repository configuration", status=500)

        token = get_hf_token(repo)

        # Recursively collect all files (only metadata, not content)
        files = self._collect_files(repo_id, repo.repo_type, repo.branch, "", token)
        if files is None:
            return HttpResponse("Failed to fetch repository contents", status=502)

        log_access(repo, "downloaded", request)

        response = StreamingHttpResponse(
            self._stream_zip(files, repo_id, repo.repo_type, repo.branch, token),
            content_type="application/zip",
        )
        response["Content-Disposition"] = f'attachment; filename="{anonymous_id}.zip"'
        return response

    def _stream_zip(self, files, repo_id, repo_type, branch, token):
        """Generator that yields ZIP bytes as each file is added."""
        buf = _ZipStreamBuffer()
        zf = zipfile.ZipFile(buf, "w", zipfile.ZIP_STORED)

        for file_entry in files:
            hf_url = build_resolve_url(repo_id, repo_type, branch, file_entry["path"])
            headers = {}
            if token:
                headers["Authorization"] = f"Bearer {token}"
            try:
                resp = http_requests.get(hf_url, headers=headers, timeout=60)
                if resp.status_code == 401:
                    resp = http_requests.get(hf_url, timeout=60)
                if resp.status_code == 200:
                    zf.writestr(file_entry["path"], resp.content)
                    chunk = buf.drain()
                    if chunk:
                        yield chunk
            except http_requests.RequestException:
                continue

        # Close writes the central directory
        zf.close()
        chunk = buf.drain()
        if chunk:
            yield chunk

    def _collect_files(self, repo_id, repo_type, branch, path, token, depth=0):
        """Recursively collect all file entries from the tree."""
        if depth > 10:
            return []

        tree = get_tree(repo_id, repo_type, branch, path, token)
        if tree is None:
            return None if depth == 0 else []

        files = []
        for entry in tree:
            if entry.get("type") == "file":
                files.append(entry)
            elif entry.get("type") == "directory":
                sub_files = self._collect_files(
                    repo_id, repo_type, branch, entry["path"], token, depth + 1
                )
                if sub_files:
                    files.extend(sub_files)
        return files
