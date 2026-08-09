import requests
import responses

from anonymizer.services.huggingface_client import (
    build_resolve_url,
    check_repo_access,
    get_repo_info,
    get_tree,
    parse_hf_url,
    validate_hf_url,
)


class TestParseHfUrl:
    def test_dataset_url(self):
        result = parse_hf_url("https://huggingface.co/datasets/user/repo")
        assert result == {"repo_type": "dataset", "repo_id": "user/repo"}

    def test_dataset_url_with_branch(self):
        result = parse_hf_url("https://huggingface.co/datasets/user/repo/tree/anon-branch")
        assert result == {"repo_type": "dataset", "repo_id": "user/repo", "branch": "anon-branch"}

    def test_model_url_explicit(self):
        result = parse_hf_url("https://huggingface.co/models/user/repo")
        assert result == {"repo_type": "model", "repo_id": "user/repo"}

    def test_model_url_implicit(self):
        result = parse_hf_url("https://huggingface.co/user/repo")
        assert result == {"repo_type": "model", "repo_id": "user/repo"}

    def test_model_url_with_branch(self):
        result = parse_hf_url("https://huggingface.co/user/repo/tree/my-branch")
        assert result == {"repo_type": "model", "repo_id": "user/repo", "branch": "my-branch"}

    def test_invalid_url(self):
        assert parse_hf_url("https://github.com/user/repo") == {}

    def test_too_short_path(self):
        assert parse_hf_url("https://huggingface.co/user") == {}

    def test_www_prefix(self):
        result = parse_hf_url("https://www.huggingface.co/datasets/user/repo")
        assert result == {"repo_type": "dataset", "repo_id": "user/repo"}


class TestValidateHfUrl:
    def test_valid_dataset_url(self):
        is_valid, error = validate_hf_url("https://huggingface.co/datasets/user/my-repo")
        assert is_valid
        assert error is None

    def test_empty_url(self):
        is_valid, error = validate_hf_url("")
        assert not is_valid
        assert "required" in error.lower()

    def test_non_hf_url(self):
        is_valid, error = validate_hf_url("https://github.com/user/repo")
        assert not is_valid
        assert "HuggingFace" in error


@responses.activate
def test_get_repo_info():
    responses.add(
        responses.GET,
        "https://huggingface.co/api/datasets/user/repo",
        json={"id": "user/repo", "private": False},
        status=200,
    )
    info = get_repo_info("user/repo", "dataset")
    assert info["id"] == "user/repo"


@responses.activate
def test_get_repo_info_not_found():
    responses.add(
        responses.GET,
        "https://huggingface.co/api/datasets/user/repo",
        json={"error": "Not found"},
        status=404,
    )
    info = get_repo_info("user/repo", "dataset")
    assert info is None


@responses.activate
def test_get_tree():
    tree_data = [
        {"type": "file", "path": "README.md", "size": 100},
        {"type": "directory", "path": "data"},
    ]
    responses.add(
        responses.GET,
        "https://huggingface.co/api/datasets/user/repo/tree/main",
        json=tree_data,
        status=200,
    )
    result = get_tree("user/repo", "dataset", "main")
    assert len(result) == 2
    assert result[0]["path"] == "README.md"


def test_build_resolve_url_dataset():
    url = build_resolve_url("user/repo", "dataset", "main", "README.md")
    assert url == "https://huggingface.co/datasets/user/repo/resolve/main/README.md"


def test_build_resolve_url_model():
    url = build_resolve_url("user/repo", "model", "main", "config.json")
    assert url == "https://huggingface.co/user/repo/resolve/main/config.json"


def test_build_resolve_url_no_path():
    url = build_resolve_url("user/repo", "dataset", "anon-branch")
    assert url == "https://huggingface.co/datasets/user/repo/resolve/anon-branch"


class TestPathTraversalRejection:
    """A reviewer-supplied path must never escape the pinned repo/branch prefix."""

    def test_build_resolve_url_rejects_parent_segment(self):
        assert build_resolve_url("user/repo", "dataset", "main", "../../..") is None

    def test_build_resolve_url_rejects_parent_segment_mid_path(self):
        assert build_resolve_url("user/repo", "dataset", "main", "data/../../../etc") is None

    def test_build_resolve_url_neutralises_encoded_parent_segment(self):
        # requests unquotes %2e to "." when preparing; HF then normalises the
        # dots server-side. Assert on the URL that actually goes on the wire.
        url = build_resolve_url("user/repo", "dataset", "main", "%2e%2e/%2e%2e")
        sent = requests.Request("GET", url).prepare().url
        assert ".." not in sent

    def test_build_resolve_url_rejects_parent_segment_in_branch(self):
        assert build_resolve_url("user/repo", "dataset", "../..", "README.md") is None

    def test_build_resolve_url_keeps_nested_paths(self):
        url = build_resolve_url("user/repo", "dataset", "main", "data/train/part-01.csv")
        assert url == (
            "https://huggingface.co/datasets/user/repo/resolve/main/data/train/part-01.csv"
        )

    def test_build_resolve_url_keeps_branch_with_slash(self):
        url = build_resolve_url("user/repo", "model", "refs/pr/1", "config.json")
        assert url == "https://huggingface.co/user/repo/resolve/refs/pr/1/config.json"

    @responses.activate
    def test_get_tree_rejects_parent_segment_without_calling_hf(self):
        assert get_tree("user/repo", "dataset", "main", "../..") is None
        assert len(responses.calls) == 0


class TestParseHfShortDomain:
    def test_hf_co_dataset(self):
        assert parse_hf_url("https://hf.co/datasets/user/repo") == {
            "repo_type": "dataset",
            "repo_id": "user/repo",
        }

    def test_hf_co_model(self):
        assert parse_hf_url("https://hf.co/user/repo") == {
            "repo_type": "model",
            "repo_id": "user/repo",
        }

    def test_lookalike_domain_rejected(self):
        assert parse_hf_url("https://huggingface.co.evil.com/user/repo") == {}

    def test_substring_in_path_rejected(self):
        assert parse_hf_url("https://evil.com/huggingface.co/user/repo") == {}


class TestCheckRepoAccess:
    """Distinguishes 'missing', 'not visible to you', and 'could not check'."""

    URL = "https://huggingface.co/api/datasets/user/repo/tree/main"

    @responses.activate
    def test_ok_when_found(self):
        responses.add(responses.GET, self.URL, json=[], status=200)
        assert check_repo_access("user/repo", "dataset", "main") == "ok"

    @responses.activate
    def test_not_found_on_404(self):
        responses.add(responses.GET, self.URL, status=404)
        assert check_repo_access("user/repo", "dataset", "main") == "not_found"

    @responses.activate
    def test_no_access_on_401(self):
        responses.add(responses.GET, self.URL, status=401)
        assert check_repo_access("user/repo", "dataset", "main") == "no_access"

    @responses.activate
    def test_no_access_on_403(self):
        responses.add(responses.GET, self.URL, status=403)
        assert check_repo_access("user/repo", "dataset", "main") == "no_access"

    @responses.activate
    def test_unknown_on_server_error(self):
        responses.add(responses.GET, self.URL, status=500)
        assert check_repo_access("user/repo", "dataset", "main") == "unknown"

    @responses.activate
    def test_unknown_on_network_failure(self):
        responses.add(responses.GET, self.URL, body=requests.RequestException("boom"))
        assert check_repo_access("user/repo", "dataset", "main") == "unknown"

    @responses.activate
    def test_traversal_never_reaches_huggingface(self):
        assert check_repo_access("user/repo", "dataset", "../..") == "not_found"
        assert len(responses.calls) == 0
