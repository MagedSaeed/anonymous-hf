# Feature 9: Admin Dashboard & Moderation

**Dependencies**: Feature 8

**Goal**: Platform administration tools for monitoring and moderation.

---

## Django Admin Enhancements

### Custom Admin Site

**Enhanced admin index**:
- Platform statistics overview
- Recent activity
- Quick actions
- System health status

### AnonymousRepo Admin

**List display**:
- Anonymous ID (clickable)
- Owner username
- Repo type badge
- Status (colored)
- Created date
- Expires date
- View count

**List filters**:
- Status (active, expired, deleted)
- Repo type (dataset, model)
- Created date range
- Expiry date range
- Owner

**Search**:
- Anonymous ID
- Original URL
- Owner email

**Actions** (bulk):
- Extend expiry (30 days)
- Mark as deleted
- Export to CSV

**Detail view**:
- All fields
- Activity log (inline)
- Proxy URL (clickable)
- "View on HuggingFace" link

### User Admin

**List display**:
- Username
- Email
- HF username
- Join date
- Active repos count
- Total views

**Filters**:
- Join date
- Has active repos
- Email notifications enabled

**Search**:
- Username
- Email
- HF username

**Actions**:
- Deactivate user (bulk)
- Send notification email

### ActivityLog Admin

**List display**:
- Timestamp
- Action
- Repo ID
- IP address
- User agent (truncated)

**Filters**:
- Action type
- Date range
- Repo

**Search**:
- IP address
- Repo ID

**Read-only**: All fields (audit log)

---

## Admin Dashboard Page

### Statistics Widget

**Metrics**:
- Total users
- Total repos created
- Active repos
- Repos expiring soon (<7 days)
- Total views (all time)
- Views today

**Charts**:
- Repos created per day (last 30 days)
- Views per day (last 30 days)
- Repo types distribution (pie chart)

### Recent Activity

**Table**:
- Last 20 activities across all repos
- Timestamp, action, repo, IP

### System Health

**Status indicators**:
- Database: Connected
- Redis: Connected (if used)
- HuggingFace API: Accessible
- Disk space: Available
- Memory usage

---

## Moderation Tools

### Abuse Detection

**Automated flags**:
- Repos with >1000 views/day (potential abuse)
- Same IP accessing 50+ different repos
- Rapid repo creation (>10/day from one user)

**Flag model**:
```python
class AbuseFlag:
    repo = ForeignKey(AnonymousRepo)
    reason = CharField()  # 'high_traffic', 'rapid_creation', 'suspicious_ip'
    flagged_at = DateTimeField(auto_now_add=True)
    reviewed = BooleanField(default=False)
    action_taken = TextField(blank=True)
```

**Admin view**:
- List all flags
- Filter: reviewed/unreviewed
- Actions: Mark reviewed, delete repo, ban user

### Manual Moderation

**Admin actions**:
- Delete repo (immediate)
- Ban user (prevent new repos)
- Extend expiry (reward good users)

---

## Admin API Endpoints

**GET /admin-api/stats/**
- Platform statistics (JSON)
- Requires: superuser authentication

**GET /admin-api/health/**
- System health check
- Database, Redis, HF API status

**GET /admin-api/abuse-flags/**
- List flagged repos
- Pagination, filtering

---

## Email to Admins

**Daily digest**:
- New users today
- Repos created today
- Abuse flags raised
- System errors (from logs)

**Immediate alerts**:
- System down
- Database errors
- High traffic spike

---

## Export Tools

### Data Export

**Management command**:
```python
# Export all repos to CSV
python manage.py export_repos --output repos.csv

# Export activity logs
python manage.py export_activity --start-date 2024-01-01 --output activity.csv
```

**CSV format**:
- All relevant fields
- Human-readable timestamps
- Privacy: Don't export IP addresses

---

## Analytics Dashboard

### Usage Analytics

**Metrics to track**:
- Daily active users (DAU)
- Monthly active users (MAU)
- Repo creation rate
- Average repo lifespan
- Most popular repos (by views)

**Visualization**:
- Line charts (trends over time)
- Bar charts (comparisons)
- Tables (top 10 lists)

### User Behavior

**Insights**:
- Average repos per user
- Repo type preferences
- Peak usage times
- Geographic distribution (optional)

---

## Permissions

**Superuser only**:
- Full Django admin access
- Delete users/repos
- View all data
- Access admin dashboard

**Staff (optional)**:
- View-only access to admin
- Can't delete or modify
- Useful for support team

---

## Testing

**Admin tests**:
- Superuser can access admin
- Regular user cannot
- List views display correctly
- Filters work
- Actions work (bulk operations)

**Dashboard tests**:
- Statistics calculate correctly
- Charts render
- Health checks work

**Coverage**: 80%+

---

## Acceptance Criteria

- [ ] Admin site shows enhanced interface
- [ ] Statistics dashboard displays metrics
- [ ] Can filter and search repos/users
- [ ] Bulk actions work correctly
- [ ] Activity logs are searchable
- [ ] Abuse flags are created automatically
- [ ] Export commands work
- [ ] Email digest sends daily
- [ ] Only superusers can access
- [ ] Tests achieve 80%+ coverage

---

## Implementation Notes

**Use Django Admin**: Don't build custom admin from scratch.

**Keep it simple**: Focus on essential moderation tools.

**Privacy**: Be careful with IP addresses, user agents.

**Security**: Admin site only accessible via HTTPS, rate limited.
