import re
from urllib.parse import quote, urlparse

import requests

HF_API_BASE = "https://huggingface.co/api"

# Matched against the parsed hostname, never as a substring of the URL.
HF_HOSTNAMES = frozenset(["huggingface.co", "www.huggingface.co", "hf.co", "www.hf.co"])


def _safe_repo_path(path):
    """Percent-encode a user-supplied path for use in a HuggingFace URL.

    Returns None if the path tries to escape the repo via a ".." segment.
    Both steps matter: quote() leaves ".." untouched, while the ".." check
    alone would miss encoded forms like %2e%2e that requests later unquotes.
    """
    if not path:
        return ""
    segments = []
    for segment in path.split("/"):
        if segment in ("", "."):
            continue
        if segment == "..":
            return None
        segments.append(quote(segment, safe=""))
    return "/".join(segments)


def parse_hf_url(url):
    """
    Parse a HuggingFace URL and extract repo type and repo_id.

    Supports:
      - https://huggingface.co/datasets/user/repo
      - https://huggingface.co/user/repo  (model)
      - https://huggingface.co/datasets/user/repo/tree/branch-name

    Returns dict with keys: repo_type, repo_id, branch (optional)
    """
    parsed = urlparse(url)
    if parsed.hostname not in HF_HOSTNAMES:
        return {}

    path = parsed.path.strip("/")
    parts = path.split("/")

    if len(parts) < 2:
        return {}

    if parts[0] == "datasets" and len(parts) >= 3:
        result = {"repo_type": "dataset", "repo_id": f"{parts[1]}/{parts[2]}"}
        if len(parts) >= 5 and parts[3] == "tree":
            result["branch"] = "/".join(parts[4:])
        return result

    if parts[0] == "models" and len(parts) >= 3:
        result = {"repo_type": "model", "repo_id": f"{parts[1]}/{parts[2]}"}
        if len(parts) >= 5 and parts[3] == "tree":
            result["branch"] = "/".join(parts[4:])
        return result

    # Default: treat as model (huggingface.co/user/repo)
    if len(parts) >= 2 and not parts[0].startswith("api"):
        result = {"repo_type": "model", "repo_id": f"{parts[0]}/{parts[1]}"}
        if len(parts) >= 4 and parts[2] == "tree":
            result["branch"] = "/".join(parts[3:])
        return result

    return {}


def check_repo_access(repo_id, repo_type="dataset", branch="main", token=None):
    """Returns "ok", "not_found", "no_access", or "unknown" (HF unreachable)."""
    safe_repo = _safe_repo_path(repo_id)
    safe_branch = _safe_repo_path(branch)
    if not safe_repo or not safe_branch:
        return "not_found"

    api_type = "datasets" if repo_type == "dataset" else "models"
    api_url = f"{HF_API_BASE}/{api_type}/{safe_repo}/tree/{safe_branch}"

    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    try:
        resp = requests.get(api_url, headers=headers, timeout=10)
    except requests.RequestException:
        return "unknown"

    if resp.status_code == 200:
        return "ok"
    if resp.status_code == 404:
        return "not_found"
    if resp.status_code in (401, 403):
        return "no_access"
    return "unknown"


def get_repo_info(repo_id, repo_type="dataset", token=None):
    """Get basic metadata about a HuggingFace repo."""
    if repo_type == "dataset":
        api_url = f"{HF_API_BASE}/datasets/{repo_id}"
    else:
        api_url = f"{HF_API_BASE}/models/{repo_id}"

    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    try:
        resp = requests.get(api_url, headers=headers, timeout=10)
        if resp.status_code == 200:
            return resp.json()
    except requests.RequestException:
        pass
    return None


def get_tree(repo_id, repo_type="dataset", branch="main", path="", token=None):
    """Get the file tree for a HuggingFace repo. None if the path escapes the repo."""
    safe_repo = _safe_repo_path(repo_id)
    safe_branch = _safe_repo_path(branch)
    safe_path = _safe_repo_path(path)
    if not safe_repo or not safe_branch or safe_path is None:
        return None

    api_type = "datasets" if repo_type == "dataset" else "models"
    api_url = f"{HF_API_BASE}/{api_type}/{safe_repo}/tree/{safe_branch}"

    if safe_path:
        api_url = f"{api_url}/{safe_path}"

    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    try:
        resp = requests.get(api_url, headers=headers, timeout=10)
        if resp.status_code == 200:
            return resp.json()
    except requests.RequestException:
        pass
    return None


def build_resolve_url(repo_id, repo_type="dataset", branch="main", file_path=""):
    """Build the HuggingFace resolve URL for a file. None if it escapes the repo."""
    safe_repo = _safe_repo_path(repo_id)
    safe_branch = _safe_repo_path(branch)
    safe_file = _safe_repo_path(file_path)
    if not safe_repo or not safe_branch or safe_file is None:
        return None

    if repo_type == "dataset":
        base = f"https://huggingface.co/datasets/{safe_repo}/resolve/{safe_branch}"
    else:
        base = f"https://huggingface.co/{safe_repo}/resolve/{safe_branch}"
    if safe_file:
        return f"{base}/{safe_file}"
    return base


def get_file_content(repo_id, repo_type="dataset", branch="main", file_path="", token=None):
    """Fetch a text file's content. None if it cannot be read."""
    url = build_resolve_url(repo_id, repo_type, branch, file_path)
    if url is None:
        return None

    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    try:
        resp = requests.get(url, headers=headers, timeout=10)
        if resp.status_code == 200:
            return resp.text
    except requests.RequestException:
        pass
    return None


def _get_user_orgs(token):
    """Fetch organizations the OAuth token has been granted access to.

    The whoami-v2 response includes fine-grained permission scopes that
    indicate which orgs the user authorized during the OAuth flow.  Only
    those orgs are returned so we don't list repos the token can't reach.
    """
    if not token:
        return []
    try:
        resp = requests.get(
            "https://huggingface.co/api/whoami-v2",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10,
        )
        if resp.status_code != 200:
            return []

        data = resp.json()

        # Build set of org names that the token was explicitly granted
        # access to via OAuth fine-grained scopes.
        auth = data.get("auth", {})
        access_token = auth.get("accessToken", {})
        fine_grained = access_token.get("fineGrained", {})
        scoped = fine_grained.get("scoped", [])

        allowed_orgs = set()
        for scope in scoped:
            entity = scope.get("entity", {})
            if entity.get("type") == "org" and entity.get("name"):
                allowed_orgs.add(entity["name"])

        if allowed_orgs:
            # Only include orgs the OAuth token can actually access
            return [
                org.get("name", "")
                for org in data.get("orgs", [])
                if org.get("name") and org["name"] in allowed_orgs
            ]

        # Fallback: if no fine-grained info is present (e.g. personal
        # access token instead of OAuth), return all user orgs.
        return [org.get("name", "") for org in data.get("orgs", []) if org.get("name")]
    except requests.RequestException:
        pass
    return []


def _fetch_repos_for_author(author, token=None):
    """Fetch models and datasets for a given author (user or org)."""
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    repos = []
    for repo_type in ("model", "dataset"):
        api_type = "models" if repo_type == "model" else "datasets"
        api_url = f"{HF_API_BASE}/{api_type}?author={author}&limit=200"
        try:
            resp = requests.get(api_url, headers=headers, timeout=15)
            if resp.status_code == 200:
                for item in resp.json():
                    repos.append(
                        {
                            "repo_id": item.get("id", ""),
                            "repo_type": repo_type,
                            "name": item.get("id", "").split("/")[-1],
                            "private": item.get("private", False),
                        }
                    )
        except requests.RequestException:
            continue
    return repos


def list_user_repos(username, token=None):
    """Fetch the user's models and datasets, including from their organizations."""
    repos = _fetch_repos_for_author(username, token)

    # Also fetch repos from the user's organizations
    orgs = _get_user_orgs(token)
    for org in orgs:
        repos.extend(_fetch_repos_for_author(org, token))

    return repos


def get_latest_commit(repo_id, repo_type="dataset", branch="main", token=None):
    """Fetch the latest commit SHA for a repo on the given branch.

    Uses the HF API tree endpoint which returns quickly and includes
    the commit hash in the response headers (X-Repo-Commit).
    Falls back to the repo info endpoint.
    """
    api_type = "datasets" if repo_type == "dataset" else "models"
    api_url = f"{HF_API_BASE}/{api_type}/{repo_id}/revision/{branch}"

    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    try:
        resp = requests.get(api_url, headers=headers, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            # The revision endpoint returns commit info with "sha" field
            sha = data.get("sha") or data.get("id")
            if sha:
                return sha
    except requests.RequestException:
        pass

    # Fallback: get from repo info
    info = get_repo_info(repo_id, repo_type, token)
    if info:
        return info.get("sha")
    return None


COLAB_HOSTNAMES = frozenset(["colab.research.google.com", "colab.google.com"])


def validate_colab_url(url):
    """Validate an optional Colab URL. Returns (is_valid, error_message)."""
    if not url:
        return True, None

    if urlparse(url).hostname not in COLAB_HOSTNAMES:
        return False, "Not a valid Colab URL. Expected a colab.research.google.com link."

    return True, None


def validate_hf_url(url):
    """
    Validate that a URL is a valid HuggingFace repo URL.
    Returns (is_valid, error_message).
    """
    if not url:
        return False, "URL is required."

    parsed = parse_hf_url(url)
    if not parsed:
        return (
            False,
            "Not a valid HuggingFace URL. Expected format: https://huggingface.co/datasets/user/repo",
        )

    repo_id = parsed.get("repo_id", "")
    if not re.match(r"^[\w.-]+/[\w.-]+$", repo_id):
        return False, f"Invalid repository ID: {repo_id}"

    return True, None
