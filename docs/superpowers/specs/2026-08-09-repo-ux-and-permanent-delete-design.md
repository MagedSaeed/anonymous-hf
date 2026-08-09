# Settings Deep-Link, Action Hierarchy, and Permanent Deletion

Date: 2026-08-09

Three independent fixes to the authenticated app: deep-linking Settings to the
correct tab, giving repository actions a visual hierarchy, and allowing owners
to permanently delete a repository.

## 1. Settings Deep-Link

### Problem

`SettingsPage` holds `activeTab` in `useState`, defaulting to `profile`. Four
banners warn that the HuggingFace API token is missing and link to
`/app/settings`, which lands the user on Profile. The token lives under
Preferences, so every one of those links drops the user on the wrong tab.

### Design

`activeTab` becomes derived state, read from the URL via `useSearchParams`:

| URL | Tab |
| --- | --- |
| `/app/settings` | Profile |
| `/app/settings?tab=preferences` | Preferences |
| `/app/settings?tab=danger` | Danger Zone |

The `tab` value is validated against the three known ids; anything else falls
back to `profile`. Clicking a tab calls `setSearchParams({ tab: id }, { replace:
true })`, which keeps the URL truthful and shareable without stacking history
entries. The `useState` for `activeTab` is removed — the URL is the single
source of truth.

The four token-warning banners link to `/app/settings?tab=preferences`:

- `frontend/src/pages/Dashboard/DashboardPage.tsx`
- `frontend/src/pages/Home/HomePage.tsx`
- `frontend/src/pages/CreateRepo/CreateRepoPage.tsx`
- `frontend/src/pages/RepoDetails/RepoDetailsPage.tsx`

The Navbar's two generic Settings links stay bare and continue to open Profile.

### Rejected alternative

Passing `state={{ tab }}` through `<Link>`. It does not survive a page refresh
and produces no shareable URL, for no compensating benefit.

## 2. Action Hierarchy

### Problem

Two separate symptoms of the same issue — nothing on the repository surfaces
signals which action matters.

On the dashboard, `RepoCard` renders "Details" as a faint amber text link in the
bottom-right corner, competing with the expiry text beside it. That link is the
only route into the repository edit UI, and the word "Details" reads as
read-only.

On the details page, every action is `btn-secondary` except "Expire Now" and
"Delete", which are solid red. The two loudest elements on the page are the two
destructive ones.

### Design — dashboard card

The text link becomes a small solid amber button labelled **Manage** with a
trailing arrow, using the `bg-amber-400 text-slate-900` treatment the dashboard
filter pills already use:

```
 88 days left                    [ Manage → ]
```

"Manage" rather than "Edit" because the target page also expires, deletes,
previews, and shows the activity log.

Rejected alternative: making the entire card a link. The card already contains
three interactive elements (HuggingFace link, anonymous URL, copy button), so
this requires nested-anchor workarounds and click-propagation handling for a
marginal gain.

### Design — details page

| Action | Current | Proposed |
| --- | --- | --- |
| Update (revision), Add/Update (Colab) | secondary | primary when dirty; secondary when clean or disabled |
| Restore (deleted repo) | secondary | primary |
| Pin to Latest, Set Expiry, Preview | secondary | unchanged |
| Expire Now, Delete | solid danger | outline danger |

The dirty-state promotion needs no new state. Both buttons are already
`disabled` when the input matches the saved value, so "enabled" already means
"there is an unsaved edit" — the colour change only makes that visible.

Demoting the destructive pair to an outline treatment reserves solid red for the
confirm dialog's final button, which is where the irreversible click actually
happens.

This needs one new utility in `frontend/src/index.css`:
`.btn-danger-outline` — transparent background, red text, red border, red-50
hover fill, with dark-mode equivalents matching the existing `.btn-*` block.

## 3. Permanent Deletion

### Problem

`RepoDetailView.perform_destroy` makes `DELETE` a no-op once a repository is
already soft-deleted, and the UI states that "permanent deletion is not
available" because it "would invalidate the anonymous URL with no way to
recover it".

That rationale does not hold:

- `anonymous_id` is a random 12-character string under a unique constraint, so a
  released id is never recycled and cannot collide with a future repository.
- Account deletion already hard-deletes every repository the user owns, via the
  `owner` foreign key cascade. The destructive capability exists; refusing
  single-repository deletion only makes the coarsest tool the only tool.

Invalidating the anonymous URL is precisely the outcome the owner is asking for.
The real risk is an accidental click, which is a confirmation-design problem,
not a reason to withhold the capability.

### Design — backend

`RepoDetailView` overrides `destroy()` and reads a `permanent` query parameter:

| Request | Repo status | Result |
| --- | --- | --- |
| `DELETE` | active / expired | soft-delete, `ActivityLog` "deleted" (unchanged) |
| `DELETE` | deleted | no-op, 204 (unchanged) |
| `DELETE ?permanent=true` | deleted | `instance.delete()`, 204 |
| `DELETE ?permanent=true` | active / expired | 400, `{"error": "Soft-delete the repository before deleting it permanently."}` |

Only the exact string `"true"` (case-insensitive) counts as opt-in; any other
value, including `"1"` and an empty parameter, is treated as absent and takes
the soft-delete path.

The explicit opt-in parameter matters. Without it, two consecutive plain
`DELETE` calls would silently destroy the record.

Requiring `status == "deleted"` first enforces the two-step flow at the API
level, not just in the UI.

`ActivityLog` rows are removed by the existing `on_delete=CASCADE` on
`ActivityLog.anonymous_repo`. No new URL, serializer, model field, or migration
is required. Ownership is already enforced by `IsOwner` plus the
`.filter(owner=self.request.user)` queryset, so another user's id returns 404
before any of this logic runs.

### Design — frontend

`ConfirmDialog` gains two optional props:

- `requireText?: string` — when present, the dialog renders a text input and
  keeps the confirm button disabled until the trimmed input matches exactly.
- `requireTextLabel?: string` — the label above that input.

Both are optional, so all four existing call sites are untouched.

On `RepoDetailsPage`, the deleted-repo branch drops the "permanent deletion is
not available" notice and gains a danger panel:

```
  [Restore]   [Preview]

  ┌─ Delete permanently ────────────────────────┐
  │ Permanently removes this repository record  │
  │ and its activity log from this service.     │
  │ /a/ab12cd34ef56/ stops working for good     │
  │ and cannot be restored.                     │
  │                                             │
  │                     [ Delete Permanently ]  │
  └─────────────────────────────────────────────┘
```

The anonymous URL renders as a monospace code span, not a live link — it is
about to stop working and should not invite a click.

Confirm dialog copy:

> **Delete Permanently**
>
> This permanently removes the repository record and its activity log.
> `/a/ab12cd34ef56/` stops working for good and cannot be restored.
>
> Type `ab12cd34ef56` to confirm.

Confirm label: "Delete Forever". `requireText` is the repository's
`anonymous_id`.

The copy deliberately does not mention HuggingFace. "Repository record" and
"from this service" already scope the action; naming HuggingFace would only
raise the doubt the sentence just answered. If that reassurance is worth
stating, it belongs once on the Guidelines page as a property of the service.

On success the handler calls `DELETE /api/repos/{id}/?permanent=true` and then
navigates to `/app/dashboard`, since the record no longer exists to render.
`Restore` in this same panel is promoted to `btn-primary` per section 2.

## Testing

Backend (`backend/anonymizer/tests/test_views.py`) covers all four rows of the
destroy table:

- `?permanent=true` on a soft-deleted repo removes the row from the database
- `?permanent=true` on an active repo returns 400 and leaves status unchanged
- `?permanent=true` on an expired repo returns 400 and leaves status unchanged
- the two existing tests — soft-delete, and no-op on an already-deleted repo —
  continue to pass unchanged

Frontend test coverage is thin (four test files in total), so this adds one
focused test for the `ConfirmDialog` `requireText` gate: the confirm button is
disabled until the typed value matches. The remaining changes are styling and
routing, verified by `npx tsc --noEmit`, `npm run lint`, and a manual pass over
the dashboard, Settings tabs, and the three repository states.

## Out of Scope

- Renaming or restructuring the Settings tabs themselves
- Bulk deletion from the dashboard
- Any change to proxy behaviour for deleted repositories (they already 404)
- Adding the "we never write to your HuggingFace repository" note to the
  Guidelines page
