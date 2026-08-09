"""Best-effort detection of content that would identify a repo owner.

Returns examples only -- never a verdict. Callers always warn the owner to
check their branch; findings are illustrations, not a complete list. This
never rewrites content.
"""

import re

PATTERNS = [
    ("arxiv", re.compile(r"https?://arxiv\.org/(?:abs|pdf)/[\w.\-/]+", re.I)),
    ("arxiv", re.compile(r"10\.48550/arxiv\.[\w.]+", re.I)),
    ("arxiv", re.compile(r"arxiv:\s*\d{4}\.\d{4,5}(?:v\d+)?", re.I)),
    ("github", re.compile(r"https?://(?:www\.)?github\.com/[\w.\-]+(?:/[\w.\-]+)?", re.I)),
    ("email", re.compile(r"[\w.+\-]+@[\w\-]+\.[\w.\-]+")),
    ("author", re.compile(r"author\s*=\s*\{[^}]*\}", re.I)),
]


def scan_for_identity(content):
    """Return example {kind, line, match} dicts for identifying content."""
    if not content:
        return []

    findings = []
    seen = set()
    for number, line in enumerate(content.splitlines(), start=1):
        for kind, pattern in PATTERNS:
            for match in pattern.finditer(line):
                text = match.group(0)
                key = (kind, number, text)
                if key in seen:
                    continue
                seen.add(key)
                findings.append({"kind": kind, "line": number, "match": text})
    return findings
