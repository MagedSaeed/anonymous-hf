# Feature 4: API Endpoints

**Dependencies**: Feature 2, Feature 3

**Goal**: REST API for creating and managing anonymous repositories.

---

## Endpoints

### Anonymous Repos

**POST /api/repos/**
- Create new anonymous repo
- Input: `original_url`, `branch` (optional), `expiry_days` (optional)
- Validation: Check HF repo exists, branch exists
- Response: AnonymousRepo object with `anonymous_url`

**GET /api/repos/**
- List user's anonymous repos
- Query params: `status`, `repo_type`, `ordering`
- Pagination: 20 per page
- Response: Paginated list

**GET /api/repos/{id}/**
- Get single repo details
- Include: activity log summary (view count, last accessed)
- Ownership check: Only owner can view

**PATCH /api/repos/{id}/**
- Update repo: extend expiry, change status
- Fields: `expires_at`, `status`
- Ownership check

**DELETE /api/repos/{id}/**
- Delete repo (soft delete: status=deleted)
- Ownership check

### Activity Logs

**GET /api/repos/{id}/activity/**
- Get activity logs for a repo
- Pagination: 50 per page
- Ownership check

---

## Serializers

**AnonymousRepoSerializer**:
- All fields + computed: `days_until_expiry`, `is_expired`
- Read-only: `anonymous_id`, `anonymous_url`, `created_at`

**CreateRepoSerializer**:
- Input fields: `original_url`, `branch`, `expiry_days`
- Validation: HF repo exists using HuggingFaceClient

**ActivityLogSerializer**:
- Fields: `action`, `timestamp`, `ip_address`
- Exclude: user_agent (too verbose)

---

## Permissions

**IsOwner**: Custom permission class
- Check: `obj.owner == request.user`
- Used for: detail, update, delete, activity views

---

## Validation

**HuggingFace repo validation**:
```python
def validate_original_url(value):
    parsed = HuggingFaceClient.parse_hf_url(value)
    if not HuggingFaceClient.repo_exists(parsed['repo_id']):
        raise ValidationError("Repository not found on HuggingFace")
    return value
```

**Branch validation**:
- Default to "main" if not provided
- Check branch exists on HF repo

**Expiry validation**:
- Min: 1 day
- Max: 365 days
- Default: User's `default_expiry_days`

---

## Error Handling

**Standard responses**:
- 400: Validation error (invalid HF URL, branch doesn't exist)
- 401: Not authenticated
- 403: Not owner
- 404: Repo not found
- 500: Server error

**Error format**:
```json
{
  "error": "Repository not found on HuggingFace",
  "field": "original_url"
}
```

---

## Testing

**Unit tests**:
- Serializer validation (valid/invalid HF URLs)
- Permission classes
- Queryset filtering

**Integration tests**:
- Create repo flow (mock HF API)
- List repos with filters
- Update expiry
- Delete repo
- Activity logs

**Coverage**: 90%+

---

## Acceptance Criteria

- [ ] Can create anonymous repo via API
- [ ] HF validation rejects invalid repos
- [ ] List endpoint filters and paginates correctly
- [ ] Only owner can access/update/delete their repos
- [ ] Activity logs track all access
- [ ] Error responses are consistent
- [ ] Tests achieve 90%+ coverage

---

## Implementation Notes

**Keep it simple**: Standard DRF viewsets and serializers.

**No background tasks yet**: Everything synchronous. Background processing comes in Feature 6 if needed.

**Mock HF API**: In tests, mock HuggingFaceClient responses.
