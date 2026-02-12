import responses

from anonymizer.services.huggingface_client import (
    build_resolve_url,
    get_repo_info,
    get_tree,
    parse_hf_url,
    validate_hf_url,
    validate_repo_exists,
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
def test_validate_repo_exists_true():
    responses.add(
        responses.GET,
        "https://huggingface.co/api/datasets/user/repo/tree/main",
        json=[{"type": "file", "path": "README.md"}],
        status=200,
    )
    assert validate_repo_exists("user/repo", "dataset", "main") is True


@responses.activate
def test_validate_repo_exists_false():
    responses.add(
        responses.GET,
        "https://huggingface.co/api/datasets/user/repo/tree/main",
        json={"error": "Not found"},
        status=404,
    )
    assert validate_repo_exists("user/repo", "dataset", "main") is False


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
