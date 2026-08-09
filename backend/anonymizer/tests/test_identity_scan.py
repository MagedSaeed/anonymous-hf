from anonymizer.services.identity_scan import scan_for_identity


class TestScanForIdentity:
    """Best-effort detection of content that would identify a repo owner."""

    def test_clean_content_has_no_findings(self):
        assert scan_for_identity("# My Dataset\n\nA collection of examples.\n") == []

    def test_empty_content_has_no_findings(self):
        assert scan_for_identity("") == []

    def test_finds_arxiv_abs_url(self):
        findings = scan_for_identity("See https://arxiv.org/abs/2401.12345 for details.")
        assert [f["kind"] for f in findings] == ["arxiv"]
        assert findings[0]["match"] == "https://arxiv.org/abs/2401.12345"

    def test_finds_arxiv_pdf_url(self):
        findings = scan_for_identity("http://arxiv.org/pdf/2401.12345v2")
        assert [f["kind"] for f in findings] == ["arxiv"]

    def test_finds_bare_arxiv_id(self):
        findings = scan_for_identity("Cite arXiv:2401.12345 please.")
        assert [f["kind"] for f in findings] == ["arxiv"]

    def test_finds_arxiv_doi(self):
        findings = scan_for_identity("doi.org/10.48550/arXiv.2401.12345")
        assert [f["kind"] for f in findings] == ["arxiv"]

    def test_finds_github_url(self):
        findings = scan_for_identity("Code at https://github.com/realname/project")
        assert [f["kind"] for f in findings] == ["github"]

    def test_finds_email(self):
        findings = scan_for_identity("Contact: jane.doe@university.edu")
        assert [f["kind"] for f in findings] == ["email"]
        assert findings[0]["match"] == "jane.doe@university.edu"

    def test_finds_bibtex_author(self):
        findings = scan_for_identity("author = {Jane Smith and John Doe}")
        assert [f["kind"] for f in findings] == ["author"]

    def test_reports_one_based_line_numbers(self):
        content = "# Title\n\nContact: jane@university.edu\n"
        findings = scan_for_identity(content)
        assert findings[0]["line"] == 3

    def test_finds_multiple_kinds_in_order(self):
        content = "https://arxiv.org/abs/2401.12345\njane@university.edu\n"
        assert [f["kind"] for f in scan_for_identity(content)] == ["arxiv", "email"]

    def test_deduplicates_identical_matches_on_same_line(self):
        content = "arXiv:2401.12345 and again arXiv:2401.12345"
        assert len(scan_for_identity(content)) == 1

    def test_does_not_flag_python_decorators_as_email(self):
        assert scan_for_identity("@property\ndef load(self):\n") == []

    def test_scans_yaml_frontmatter_too(self):
        content = "---\narxiv: 2401.12345\n---\n# Title\n"
        assert [f["kind"] for f in scan_for_identity(content)] == ["arxiv"]
