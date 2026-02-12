# Feature 7: User Settings & Profile

**Dependencies**: Feature 4

**Goal**: User profile management and platform settings.

---

## User Profile API

**GET /api/profile/**
- Get current user profile
- Fields: username, email, avatar_url, default_expiry_days, created_at

**PATCH /api/profile/**
- Update settings
- Fields: default_expiry_days (only editable field)

---

## Settings Page

### User Info Section

**Display** (read-only):
- HuggingFace username
- Avatar
- Email
- Member since date

### Preferences Section

**Editable**:
- Default expiry days (1-365)
- Save button

### Statistics Section

**Display**:
- Total repos created
- Active repos
- Total views across all repos
- Storage used: 0 (we don't store files!)

### Danger Zone

**Actions**:
- Delete account
- Confirmation required
- Cascades: All anonymous repos deleted

---

## Account Deletion

**Flow**:
1. User clicks "Delete Account"
2. Confirmation dialog: "This will delete all your anonymous repos"
3. User confirms
4. Backend: Soft delete user and all repos
5. Logout user
6. Redirect to home

**Backend**:
```python
def delete_account(request):
    user = request.user
    # Delete all repos (cascade)
    user.anonymousrepo_set.update(status='deleted')
    # Deactivate user
    user.is_active = False
    user.save()
    # Logout
    logout(request)
```

---

## React Components

### SettingsPage
- Tab navigation: Profile, Settings, Danger Zone
- Form with save button
- Success/error messages

### ProfileSection
- Display user info
- Avatar, username, email

### PreferencesForm
- Number input for default expiry
- Validation: 1-365
- Save button with loading state

### DangerZone
- Warning UI (red border)
- Delete button (red)
- Confirmation dialog

---

## Testing

**API tests**:
- Get profile
- Update default expiry
- Validation (min/max)
- Account deletion cascade

**Component tests**:
- Settings form renders
- Save updates profile
- Delete confirmation works

**Coverage**: 85%+

---

## Acceptance Criteria

- [ ] Profile page displays user info
- [ ] Can update default expiry days
- [ ] Validation prevents invalid values
- [ ] Statistics show correct counts
- [ ] Delete account requires confirmation
- [ ] Account deletion cascades to repos
- [ ] Tests achieve 85%+ coverage

---

## Implementation Notes

**Minimal settings**: Only what's necessary (default expiry).

**HF profile sync**: Username/avatar from HuggingFace (read-only).

**No password change**: OAuth-based auth, HF manages passwords.
