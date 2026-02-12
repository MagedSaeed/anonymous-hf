# Feature 6: Public Viewer

**Dependencies**: Feature 3

**Goal**: Public interface for accessing anonymous repositories (for reviewers).

---

## Public Routes

**No authentication required** - these are public endpoints.

### File Viewer (`/a/{anonymous_id}/*`)

**GET /a/{anonymous_id}/**
- Shows README.md or directory listing
- Default view for repo

**GET /a/{anonymous_id}/{path}**
- Proxies file from HuggingFace
- Streams large files
- Preserves content type

**Examples**:
- `/a/xyz123/` → README.md
- `/a/xyz123/data/train.csv` → Proxies train.csv
- `/a/xyz123/config.json` → Proxies config.json

---

## Directory Browser

### File Tree View

**Display**:
- Directory structure (tree)
- File sizes
- File types (icons)

**Actions**:
- Click file → view/download
- Click directory → expand/collapse

**Implementation**:
- Fetch tree from HF API: `/api/datasets/{repo}/tree/{branch}`
- Render as collapsible tree
- Client-side navigation

---

## File Display

### Text Files
- Display in `<pre>` with syntax highlighting
- Support: .md, .txt, .py, .json, .yaml, .csv

### Binary Files
- Download button
- File size warning for large files

### README.md
- Render as markdown
- Support: headers, lists, code blocks, links
- Use react-markdown

---

## UI Components

### AnonymousRepoHeader

**Shows**:
- Anonymous ID
- Repo type badge
- Expiry date (if close to expiring)
- "View on HuggingFace" button (goes to real repo - reviewers can verify it exists)

### FileBrowser

**Tree view**:
- Folders (expandable)
- Files (clickable)
- Current path breadcrumb

### FileViewer

**For text files**:
- Syntax highlighting (using prism or similar)
- Line numbers
- Download button

**For binary files**:
- Download button
- File info (size, type)

---

## Error Handling

**404 - Repo not found**:
- Show: "Anonymous repository not found"
- Possible reasons: expired, deleted, invalid ID

**403 - Private repo**:
- Show: "This repository is private"
- HuggingFace returned 403

**410 - Expired**:
- Show: "This repository has expired"
- Display expiry date

**500 - Server error**:
- Show: "Error loading file"
- Retry button

---

## Proxy Implementation

### Backend View

```python
def proxy_file(request, anonymous_id, path):
    # Lookup repo
    repo = get_object_or_404(AnonymousRepo, anonymous_id=anonymous_id)
    
    # Check not expired
    if repo.is_expired():
        return HttpResponse(status=410)
    
    # Build HF URL
    hf_url = f"https://huggingface.co/{repo.repo_type}s/{repo.original_repo_id}/resolve/{repo.branch}/{path}"
    
    # Proxy request
    response = requests.get(hf_url, stream=True)
    
    # Stream to client
    return StreamingHttpResponse(
        response.iter_content(chunk_size=8192),
        content_type=response.headers.get('Content-Type'),
        status=response.status_code
    )
    
    # Log access
    ActivityLog.objects.create(
        anonymous_repo=repo,
        action='viewed',
        ip_address=get_client_ip(request)
    )
```

### Frontend Component

**React component**:
- Fetches file via proxy endpoint
- Shows loading state
- Handles errors
- Renders based on file type

---

## Performance

**Streaming**:
- Don't load entire file into memory
- Stream large files chunk by chunk

**Caching**:
- Set cache headers from HuggingFace
- Browser caches static files

**Rate limiting**:
- Track requests per IP
- Prevent abuse (100 requests/hour per IP)

---

## Analytics

**Track**:
- View count per repo
- Access by IP (for security)
- Popular files
- Peak access times

**Don't track**:
- User identity (anonymous access)
- Detailed browsing patterns

---

## Testing

**Unit tests**:
- Proxy view with mocked HF responses
- Error handling (404, 403, 410, 500)
- Expiry check

**Integration tests**:
- Access valid repo
- Access expired repo
- Download large file (mock)

**Frontend tests**:
- File browser renders
- README displays as markdown
- Error states show correctly

**Coverage**: 85%+

---

## Acceptance Criteria

- [ ] Can access repo via `/a/{anonymous_id}`
- [ ] README displays as formatted markdown
- [ ] File tree shows directory structure
- [ ] Can view individual files
- [ ] Can download binary files
- [ ] Expired repos show 410 error
- [ ] Activity logs track all access
- [ ] Large files stream efficiently
- [ ] Error messages are clear
- [ ] Tests achieve 85%+ coverage

---

## Security

**No authentication**: Public access by design

**Rate limiting**: Prevent abuse via IP-based limits

**No data exposure**: Never show original repo URL in client

**Expiry enforcement**: Check on every request

---

## Implementation Notes

**Keep it simple**: Just proxy + basic file browser.

**No editing**: Read-only access only.

**Mobile-friendly**: Responsive file browser.

**Fast**: Streaming for performance, minimal processing.
