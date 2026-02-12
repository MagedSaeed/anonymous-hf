# Feature 3: Proxy Service & User Tools

**Dependencies**: Feature 2


**Goal**: Implement HTTP proxy to HuggingFace and optional helper tools for users to anonymize their repos.

---

## Core Proxy Service

### Purpose

Transparently proxy requests to HuggingFace while hiding the original repository URL.

### Proxy Flow

1. User requests: `GET /a/{anonymous_id}/README.md`
2. Look up anonymous_id → get real HF URL
3. Build HF URL: `https://huggingface.co/datasets/{user}/{repo}/resolve/{branch}/README.md`
4. Fetch from HuggingFace
5. Stream response to user
6. Log access in ActivityLog

### Requirements

**HTTP proxying**:
- Support GET requests (read-only)
- Stream responses (don't buffer large files)
- Preserve HTTP headers (Content-Type, Content-Length)
- Handle HuggingFace errors gracefully (404, 403, 500)
- Set appropriate cache headers

**Path handling**:
- Support file paths: `/a/{id}/data/train.csv`
- Support directory listings (if HF provides)
- Handle special files: README.md, .gitattributes

**Authentication**:
- Use platform's HF token for public repos
- Support user's HF token for private repos (if provided)

**Rate limiting**:
- Track requests per anonymous repo
- Implement basic rate limiting (prevent abuse)
- Log excessive access attempts

---

## Optional User Helper Tools

**Note**: Users do their own anonymization in HF branches. These tools are optional helpers.

### Anonymization Guidelines Page

Static page with tips:
- Common patterns to anonymize (emails, URLs, author names)
- How to create a branch in HuggingFace
- How to edit README and configs
- Conference-specific guidelines (ACL, NeurIPS)

### Validation Helper (Optional)

Simple API endpoint to check if branch is "ready":
- Scans README for common identifiers (emails, URLs)
- Returns warnings, not errors
- User's responsibility to fix

**This is NOT required** - just a nice-to-have.

---

## Directory Listing Support

### Purpose

Allow browsing repository structure through anonymous URL.

### Implementation

**Proxy HuggingFace's file tree API**:
- Endpoint: `GET /a/{id}/tree`
- Fetch from: `https://huggingface.co/api/datasets/{repo}/tree/{branch}`
- Return JSON file listing
- Frontend displays as browsable tree

---

## Testing

**Proxy service tests**:
- Mock HuggingFace responses
- Test file proxying
- Test streaming large files
- Test error handling (404, 403, timeout)
- Test rate limiting

**Integration tests**:
- Create AnonymousRepo, access via proxy
- Verify activity logs created
- Test with various file types (text, binary, large)

**Coverage target**: 90%+ (critical service)

---

## Docker Configuration

Update docker-compose.yml:

**Backend service**:
- Increase timeout for proxying large files
- Set memory limits
- Configure logging

**Nginx (frontend)**:
- Proxy timeout settings
- Max request size
- Buffering configuration for large files

---

## Acceptance Criteria

- [ ] Proxy service successfully fetches files from HuggingFace
- [ ] Streaming works for files >100MB
- [ ] Error responses from HF are properly handled
- [ ] ActivityLog records all access
- [ ] Rate limiting prevents abuse
- [ ] Directory listings work
- [ ] Docker Compose handles proxy traffic
- [ ] Tests achieve 90%+ coverage

---

## Implementation Notes

**Keep it simple**: The proxy service should be straightforward HTTP proxying. Don't add complexity.

**User-driven anonymization**: Platform provides anonymous access, users handle anonymization. This is like Anonymous GitHub.

**No AI/ML anonymization**: Users know their data best. No automated processing.

**Performance**: Proxying is I/O bound. Use async/streaming where possible to handle multiple concurrent requests.
