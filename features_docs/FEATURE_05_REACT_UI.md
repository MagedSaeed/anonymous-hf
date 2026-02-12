# Feature 5: React UI

**Dependencies**: Feature 4

**Goal**: User interface for creating and managing anonymous repositories.

---

## Pages

### Dashboard (`/app/dashboard`)

**Purpose**: Main user page showing their anonymous repos.

**Components**:
- Repo list (table or cards)
- Status badges (active, expired)
- Quick actions (copy URL, extend, delete)
- Stats: total views, active repos

**Features**:
- Filter by status, repo type
- Sort by created date, expiry date
- Search by original URL

### Create Repo Form (`/app/create`)

**Purpose**: Submit new anonymous repo.

**Form fields**:
- HuggingFace URL (text input, required)
- Branch name (text input, default: "main")
- Expiry days (number input, default from user profile)

**Validation**:
- Real-time URL validation
- Show error if repo not found on HF

**Success**:
- Show anonymous URL
- Copy button
- Link to repo details

### Repo Details (`/app/repos/{id}`)

**Purpose**: View single repo details and activity.

**Sections**:
- Repo info (original URL, anonymous URL, status)
- Expiry countdown
- Activity logs (table)
- Actions (extend expiry, delete)

**Features**:
- Copy anonymous URL button
- View on HuggingFace button (shows real repo in new tab)
- Activity log pagination

### Guidelines Page (`/app/guidelines`)

**Purpose**: Help users anonymize their repos.

**Content** (static):
- Why anonymization matters
- Common patterns to remove (emails, names, institutions)
- How to create a branch on HuggingFace
- Conference-specific tips (ACL, NeurIPS, etc.)
- Best practices

---

## Shared Components

### RepoCard

**Props**: repo object  
**Displays**: 
- Repo type badge
- Status badge
- Original URL (truncated)
- Anonymous URL with copy button
- Expiry countdown
- View count

### CopyButton

**Props**: text to copy  
**Behavior**: 
- Click to copy
- Show "Copied!" feedback
- Reset after 2 seconds

### StatusBadge

**Props**: status  
**Styles**: 
- active: green
- expired: gray
- deleted: red

### ConfirmDialog

**Props**: message, onConfirm, onCancel  
**Use**: Delete confirmation, extend confirmation

---

## API Integration

**Use Axios with AuthContext**:
- All requests include CSRF token
- Handle 401 (redirect to login)
- Handle 403 (show error)
- Handle 500 (show error)

**Loading states**:
- Show spinner while fetching
- Disable buttons while submitting
- Skeleton loaders for lists

**Error handling**:
- Display error messages from API
- Field-level errors for forms
- Toast notifications for success/error

---

## Styling

**Follow UI Design Template**:
- Tailwind utility classes
- No custom CSS
- Responsive (mobile-first)
- Color system: gray-based with semantic colors

**Forms**:
- Label + input + error pattern
- Focus states
- Validation feedback

**Tables**:
- Responsive (cards on mobile)
- Sortable headers
- Pagination controls

---

## Testing

**Component tests**:
- RepoCard renders correctly
- CopyButton copies text
- StatusBadge shows correct color
- Forms validate input

**Page tests**:
- Dashboard loads repos
- Create form submits
- Repo details shows data

**Integration tests**:
- Full create repo flow
- Delete repo flow
- Mock API responses

**Coverage**: 75%+

---

## Acceptance Criteria

- [ ] Dashboard displays user's repos
- [ ] Create form validates HF URL
- [ ] Create form submits and shows anonymous URL
- [ ] Copy button works
- [ ] Repo details shows activity logs
- [ ] Delete confirmation works
- [ ] All pages are responsive
- [ ] Loading states show during API calls
- [ ] Error messages display properly
- [ ] Tests achieve 75%+ coverage

---

## Implementation Notes

**Keep it simple**: Basic CRUD UI, no fancy features.

**No real-time updates**: Poll if needed, but start with manual refresh.

**Mobile-friendly**: Test on mobile viewport.

**Accessibility**: Semantic HTML, keyboard navigation, ARIA labels.
