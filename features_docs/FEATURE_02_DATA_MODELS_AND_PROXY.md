# Feature 2: Data Models & HuggingFace Proxy

**Dependencies**: Feature 1


**Goal**: Create database models for URL mapping and implement proxy service to HuggingFace repositories.

---

## Architecture Overview

**Simple proxy model** (like Anonymous GitHub):
- User anonymizes their HuggingFace repo/branch themselves
- User submits branch URL to our platform
- Platform creates anonymous proxy URL
- Requests to anonymous URL are proxied to real HuggingFace branch
- **No file caching, no processing** - just URL mapping and proxying

---

## Database Models

### AnonymousRepo Model

**Purpose**: Map anonymous IDs to real HuggingFace repository branches.

**Fields**:
- Owner (User foreign key)
- Repository type: "dataset" or "model"
- Original HuggingFace URL
- Branch name (default: "main")
- Anonymous ID (12-char, auto-generated, unique)
- Anonymous URL (auto-generated)
- Status: active, expired, deleted
- Created/updated timestamps
- Expires at (default: 90 days from user preference)
- View count, access count (statistics)

**Methods**:
- `is_expired()`: Check if past expiry date
- `extend_expiry(days)`: Extend expiration
- `get_proxied_url(file_path)`: Build HuggingFace URL for proxying

**No CachedFile model needed** - we proxy directly to HuggingFace.

### AnonymizationRule Model (Optional)

**Purpose**: Store conference presets for user reference (e.g., "ACL 2024 guidelines").

**Fields**:
- Name (unique)
- Description
- Guidelines (text field)
- Is public
- Created by (User)

**This is informational only** - doesn't affect proxying.

### ActivityLog Model

**Purpose**: Track access to anonymous repos.

**Fields**:
- Anonymous repo (foreign key)
- Action: viewed, downloaded, extended, deleted
- IP address
- User agent
- Timestamp

---

## HuggingFace Proxy Service

### Purpose

Proxy HTTP requests to HuggingFace while hiding the original repo URL.

### Core Functionality

**URL translation**:
- Anonymous URL: `https://anonymous-hf.org/a/{anonymous_id}/path/to/file`
- Real URL: `https://huggingface.co/datasets/{user}/{repo}/resolve/{branch}/path/to/file`

**Proxy operations**:
- Fetch file from HuggingFace
- Stream response to client
- Preserve content types
- Handle HuggingFace errors (404, 403, etc.)
- Log access in ActivityLog

**Special files**:
- README.md: Fetch and display
- Directory listings: Proxy file tree API
- Model/dataset cards: Direct proxy

### Requirements

- Use `requests` or `httpx` for proxying
- Stream large files (don't load into memory)
- Respect HuggingFace rate limits
- Cache nothing (always fetch from HF)
- Use user's HF token if accessing private repos

---

## HuggingFace API Client

**Simplified** - only for validation and metadata:

**Methods needed**:
- `validate_repo_exists(repo_id, branch)`: Check if repo/branch exists
- `parse_hf_url(url)`: Extract repo_id and branch
- `get_repo_info(repo_id)`: Basic metadata for display

**No file downloading** - that's handled by proxy service.

---

## Django Admin

### AnonymousRepo Admin

**List display**: anonymous_id, repo_type, original_url, branch, status, expires_at, view_count

**Filters**: repo_type, status, created_at, expires_at

**Search**: anonymous_id, original_url, owner email

**Actions**: Extend expiry (bulk), Delete (bulk)

### ActivityLog Admin

**List display**: timestamp, action, anonymous_repo, IP address

**Filters**: action, timestamp

**Read-only**: All fields (audit log)

---

## Docker Setup

### Backend Dockerfile

**Multi-stage build**:
- Base: Python 3.11 with UV
- Build stage: Install dependencies
- Runtime stage: Copy code, run Gunicorn

### Frontend Dockerfile

**Multi-stage build**:
- Build: Node.js, build React app
- Runtime: Nginx, serve static files and proxy API

### docker-compose.yml

**Services**:
- `backend`: Django app
- `frontend`: Nginx + React
- `postgres`: Database (production)
- `redis`: Cache/sessions (optional)

**Development mode**: Override with docker-compose.override.yml for hot reload

---

## Serializers

**AnonymousRepoSerializer**: 
- All fields for reading
- Read-only: anonymous_id, anonymous_url, status
- Validation: Check HF repo exists

**CreateAnonymousRepoSerializer**:
- Input: original_url, branch (optional), expiry_days (optional)
- Validation: URL is valid HuggingFace repo, branch exists

---

## Testing

**Unit tests**:
- AnonymousRepo model: ID generation, URL generation, expiry logic
- URL parsing and validation
- Proxy URL construction

**Integration tests**:
- Create AnonymousRepo, verify database state
- Proxy service fetches from HuggingFace (mock HF API)
- Admin actions work

**Coverage target**: 85%+

---

## Acceptance Criteria

- [ ] AnonymousRepo model creates unique anonymous IDs
- [ ] Proxy service successfully fetches files from HuggingFace
- [ ] Proxy service streams large files efficiently
- [ ] Invalid HuggingFace URLs are rejected during creation
- [ ] ActivityLog records all access
- [ ] Docker Compose starts all services successfully
- [ ] Admin interface allows managing repos
- [ ] Tests achieve 85%+ coverage

---

## Implementation Notes

**No caching**: Always fetch fresh from HuggingFace. This ensures:
- Users can update their anonymized branch
- No storage costs
- Simpler architecture
- Always up-to-date content

**User responsibility**: User must create anonymized version of their repo in a HuggingFace branch. Platform just provides anonymous access to that branch.

**Proxy vs redirect**: Use proxy (not redirect) to hide original URL from client.
