# GitHub Star Nudge — Design

**Date:** 2026-07-23
**Status:** Approved, ready for implementation planning

## Goal

Gently and occasionally encourage authenticated users to star the project's
GitHub repository (`https://github.com/MagedSaeed/anonymous-hf`), without
nagging. The nudge stops permanently once the user either dismisses it
explicitly or clicks through to the repo. It reappears at most every 15 days
otherwise.

## Scope

- **In scope:** A dismissible centered modal shown on the authenticated
  Dashboard, with client-side (localStorage) state tracking.
- **Out of scope:** Backend changes, tracking whether the user actually starred
  the repo (GitHub does not expose this to us; clicking through counts as done),
  showing the nudge on the public viewer (`/a/{id}`) or anywhere outside the
  Dashboard.

## Behavior

### Trigger & frequency

- The nudge is rendered from the **Dashboard page only** (authenticated app).
- A **visit count** is tracked in localStorage and incremented on each Dashboard
  mount. The modal is only eligible to appear starting at the **5th visit** —
  new users get to explore first.
- Once eligible, a **15-day gate** governs re-appearance for snoozed users.
- When the modal is shown, there is a small **~2 second delay** after the
  Dashboard mounts before it appears, so it never slams the user on first render.

### Copy

> ⭐ **Enjoying Anonymous HuggingFace?**
>
> If you find this project useful, consider giving it a star on GitHub — it
> shows your trust and helps others discover it too.

### Dismissal state machine

| User action | Result | Reappears? |
|---|---|---|
| Clicks **"View on GitHub ⭐"** | Permanent stop (`status: 'dismissed'`) | Never — they went to the link |
| Checks **"Don't show this again"** (unchecked by default) then closes | Permanent stop (`status: 'dismissed'`) | Never |
| Just closes ("Maybe later") without checking | Snooze (`status: 'snoozed'`, update `lastShownAt`) | After 15 days |

## Data / Storage

Single localStorage key: `github_star_nudge`, holding a JSON object:

```ts
{
  visitCount: number,          // incremented each Dashboard mount
  status?: 'snoozed' | 'dismissed',
  lastShownAt?: string         // ISO timestamp of the last time the modal was shown
}
```

### Show-decision logic (on Dashboard mount)

1. Read and parse the record (default `{ visitCount: 0 }` if absent/invalid).
2. Increment `visitCount`, persist immediately.
3. Do **not** show if `status === 'dismissed'`.
4. Do **not** show if `visitCount < 5`.
5. If `status === 'snoozed'`: show only when `now - lastShownAt > 15 days`.
6. Otherwise (eligible, never shown): show.
7. When shown, set `lastShownAt = now` and persist.

Guard `localStorage` access and JSON parsing so a corrupt/blocked store never
crashes the Dashboard (fall back to "don't show" on error).

## Components

### `GitHubStarNudge`

New component under `frontend/src/components/GitHubStarNudge/`. Mirrors the
existing `ConfirmDialog` markup and styling conventions:

- Fixed full-screen overlay: `fixed inset-0 bg-black/40 backdrop-blur-sm ... z-50`.
- Centered card: `bg-white dark:bg-slate-800 rounded-xl ... shadow-xl`.
- Headline + body copy (see Copy above).
- A **"Don't show this again"** checkbox, unchecked by default.
- Footer buttons:
  - **"Maybe later"** — secondary (`btn-secondary`), closes the modal.
  - **"View on GitHub ⭐"** — primary (`btn-primary`), an anchor to
    `https://github.com/MagedSaeed/anonymous-hf` (opens in a new tab,
    `rel="noopener noreferrer"`), which also marks the nudge dismissed.

Props (illustrative):

```ts
interface GitHubStarNudgeProps {
  onClose: (dontShowAgain: boolean) => void   // "Maybe later" / checkbox close
  onGoToRepo: () => void                        // clicked the GitHub button
}
```

The show/gating logic lives in the Dashboard (or a small `useGitHubStarNudge`
hook) so the component itself stays a dumb, testable presentational unit.

### Dashboard integration

The Dashboard page owns the visit-count increment, the show decision, the ~2s
delay timer, and rendering `<GitHubStarNudge />` when appropriate. Extracting
the localStorage read/write/gating into a `useGitHubStarNudge` hook keeps the
Dashboard clean and makes the logic independently testable.

## Testing

`GitHubStarNudge.test.tsx` and/or a hook test covering:

- Hidden before the 5th visit (visitCount 1–4).
- Shown on the 5th eligible visit.
- Hidden permanently when `status === 'dismissed'`.
- Snoozed and <15 days since `lastShownAt` → hidden.
- Snoozed and >15 days since `lastShownAt` → shown.
- "Maybe later" without checkbox → writes `status: 'snoozed'` + `lastShownAt`.
- "Don't show this again" + close → writes `status: 'dismissed'`.
- "View on GitHub ⭐" → writes `status: 'dismissed'`.
- Corrupt/blocked localStorage → does not crash, falls back to hidden.

Use fake timers where needed for the ~2s delay and the 15-day gate; mock
`localStorage` per existing test conventions.
