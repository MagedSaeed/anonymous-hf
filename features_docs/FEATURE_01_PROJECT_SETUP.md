# Feature 1: Project Setup & Basic Infrastructure

**Dependencies**: None (first feature)


**Goal**: Establish the foundational Django + React architecture with HuggingFace OAuth authentication.

---

## Overview

Set up a Django backend with React frontend following a clean architecture with session-based authentication. The system will use HuggingFace OAuth for user login, implementing a custom OAuth2 provider since django-allauth doesn't have built-in HuggingFace support.

---

## Backend Requirements

### Django Project Structure

Create a Django project called `anonymous_hf` with two main applications:

1. **core app**: Handles user authentication and profile management
   - Custom User model extending Django's AbstractUser
   - HuggingFace OAuth integration
   - User profile endpoints
   
2. **anonymizer app**: Placeholder for business logic (populated in later features)
   - Empty models, views, urls files
   - Will contain anonymization functionality

### Settings Configuration

Implement a two-tier settings approach:
- **Development settings** (settings.py): SQLite database, debug enabled, CORS allowing localhost:3000
- **Production settings** (production_settings.py): Extends base settings, PostgreSQL via DATABASE_URL environment variable, security hardening, Redis for caching

Key configuration requirements:
- Custom User model must be configured before first migration
- Session-based authentication using Django sessions (not JWT)
- CORS middleware must be first in middleware stack
- Django REST Framework configured with SessionAuthentication and IsAuthenticated as defaults
- WhiteNoise for serving static files without nginx in development
- All secrets and configuration via environment variables using python-decouple

### Custom User Model

Extend AbstractUser to add fields needed for HuggingFace integration and user preferences:
- HuggingFace user ID (for OAuth linking)
- HuggingFace username
- Default expiry days for anonymous repos (with sensible default like 90 days)
- Optional avatar URL from HuggingFace profile

The admin interface should display these custom fields in organized fieldsets for easy management.

### HuggingFace OAuth Integration

Implement custom OAuth2 flow for HuggingFace login (django-allauth doesn't support HuggingFace provider). Follow HuggingFace OAuth documentation at https://huggingface.co/docs/hub/en/oauth.

**Required OAuth scopes**:
- `openid` - Get ID token
- `profile` - Get user profile information (username, avatar)
- `email` - Get user email address
- `read-repos` - Access user's HuggingFace repositories (needed to fetch datasets/models for anonymization)

**OAuth flow requirements**:
- Authorization URL: `https://huggingface.co/oauth/authorize`
- Token URL: `https://huggingface.co/oauth/token`
- User info URL: `https://huggingface.co/oauth/userinfo`
- Callback URL pattern: `/accounts/huggingface/callback/`
- Include state parameter for CSRF protection
- Store access tokens securely in user model or session for making HuggingFace API calls

After successful authentication, redirect users to `/app/dashboard`.

### Basic API Endpoints

Create REST API endpoints under the `/api/` URL prefix:

1. **CSRF token endpoint** (`/api/csrf-token/`): Returns CSRF token for React app, no authentication required
2. **User profile endpoint** (`/api/profile/`): Returns current authenticated user's information, requires authentication
3. **Health check endpoint** (`/api/health/`): Simple status check returning `{"status": "ok"}`, no authentication required
4. **Logout endpoint** (built into OAuth flow): Clears session and redirects appropriately

All authenticated endpoints must enforce login using DRF's IsAuthenticated permission class. Use Django's session authentication (cookies), not token-based auth.

---

## Frontend Requirements

### React Application Setup

Create a single-page React application that mounts at the `/app` path (not at root). This keeps it separate from Django-served pages like `/admin` and `/accounts`.

**Key technologies**:
- React Router 6+ with `basename="/app"` configuration
- Tailwind CSS for all styling (following UI design template)
- Axios for HTTP requests with credentials support
- Inter font from Google Fonts
- No component libraries (build custom components)

### Authentication Context

Create a React Context that manages global authentication state:
- Fetches and stores CSRF token when app loads
- Checks authentication status by calling `/api/profile/`
- Provides current user data to all components via context
- Exposes logout function
- Configures axios with defaults: `withCredentials: true`, baseURL from environment, CSRF token in headers
- Handles loading states while checking authentication

### Core Pages

Implement three initial pages:

1. **Home page** (`/`): Public landing page with "Sign in with HuggingFace" button that initiates OAuth flow
2. **Login handler** (`/login`): Handles OAuth callback and redirects, shows loading state
3. **Dashboard** (`/dashboard`): Protected page showing user profile info (username, avatar, email), requires authentication

### Protected Route Component

Create a reusable ProtectedRoute wrapper component that:
- Checks authentication state from AuthContext
- Shows loading spinner while checking
- Redirects unauthenticated users to login page
- Renders protected content for authenticated users
- Wraps any pages that require login

### Navigation Component

Build a responsive navbar that:
- Displays app branding/logo
- Shows user avatar and username when authenticated
- Provides logout button for logged-in users
- Shows "Sign in with HuggingFace" button when logged out
- Adapts layout for mobile and desktop screens
- Uses Tailwind utility classes for styling

### Tailwind Configuration

Set up Tailwind with:
- Content paths covering all JSX files
- Inter font family configuration
- Custom color palette (can use defaults or customize later)
- Basic animation utilities for smooth transitions
- Responsive design with mobile-first approach

---

## Environment Configuration

Create a comprehensive `.env.example` file documenting all required and optional environment variables:

**Required (Django)**:
- `SECRET_KEY` - Django secret key for cryptographic signing
- `DEBUG` - Boolean for debug mode
- `ALLOWED_HOSTS` - Comma-separated list of allowed hostnames
- `DATABASE_URL` - PostgreSQL connection string (production only)

**Required (HuggingFace OAuth)**:
- `HUGGINGFACE_CLIENT_ID` - OAuth application client ID from HuggingFace
- `HUGGINGFACE_CLIENT_SECRET` - OAuth application secret
- `HUGGINGFACE_REDIRECT_URI` - Full callback URL for OAuth

**Required (Security)**:
- `CSRF_TRUSTED_ORIGINS` - Comma-separated URLs with protocol (e.g., `https://example.com`)
- `CORS_ALLOWED_ORIGINS` - Comma-separated URLs with protocol for development

**Optional**:
- `REDIS_URL` - Redis connection string for caching and sessions in production
- `DJANGO_SUPERUSER_USERNAME` - Auto-create superuser with this username
- `DJANGO_SUPERUSER_EMAIL` - Superuser email
- `DJANGO_SUPERUSER_PASSWORD` - Superuser password
- `SITE_URL` - Base URL of the site for generating links

All configuration should use python-decouple for loading and type conversion.

---

## Docker Configuration

### Purpose

Provide containerized environment for development and production deployment.

### Services

**docker-compose.yml** with services:
- **backend**: Django app with Gunicorn
- **frontend**: Nginx serving React + proxying API
- **postgres**: Database (production)
- **redis**: Sessions/cache (optional)

### Backend Dockerfile

**Multi-stage build**:
- Install UV and dependencies
- Copy Django code
- Run as non-root user
- Expose port 8000

### Frontend Dockerfile

**Multi-stage build**:
- Build React app with npm
- Nginx runtime to serve static files
- Proxy /api to backend
- Expose port 80

### Development Override

**docker-compose.override.yml** for development:
- Mount source code as volumes (hot reload)
- Use Django runserver (not Gunicorn)
- Use Vite dev server (not built React)
- Expose debug ports

### Usage

```bash
# Development
docker-compose up

# Production
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up

# Rebuild
docker-compose build
```

---

## Testing Requirements

Following Feature 0 testing standards, implement tests for:

### Unit Tests

**User model tests**:
- Test custom field defaults (default_expiry_days)
- Test HuggingFace ID uniqueness constraint
- Test string representation

**OAuth flow tests** (integration):
- Mock HuggingFace OAuth endpoints
- Test successful authentication creates/updates User
- Test OAuth state parameter validation
- Test callback error handling

**API endpoint tests**:
- CSRF token endpoint returns valid token
- Profile endpoint requires authentication
- Profile endpoint returns correct user data
- Health check endpoint works without auth

### Integration Tests

**Complete OAuth flow**:
- User clicks login → redirects to HF
- Mock OAuth callback → creates user session
- User data accessible via profile endpoint

**React component tests**:
- AuthContext fetches and stores CSRF token
- AuthContext checks authentication on mount
- ProtectedRoute redirects when not authenticated
- Navbar shows correct state for logged-in/out users

### Test Coverage Targets

- User model: 100% (simple model, should be fully tested)
- OAuth views: 90%+ (critical path)
- API endpoints: 95%+
- React AuthContext: 85%+
- React components: 75%+

### Pre-commit Requirements

All code must pass:
- Ruff linting (backend)
- Black/Ruff formatting (backend)
- ESLint (frontend)
- Prettier (frontend)
- All tests passing

---

## Acceptance Criteria

Feature 1 is complete when all of the following are true:

- [ ] Django project runs without errors on `python manage.py runserver`
- [ ] React app runs without errors on `npm start`
- [ ] Database migrations execute successfully creating User model
- [ ] Custom User model includes HuggingFace-specific fields
- [ ] Django admin is accessible and displays custom User fields properly
- [ ] HuggingFace OAuth flow completes successfully (button click → HF login → callback → dashboard)
- [ ] User can log in with their HuggingFace account
- [ ] After successful login, dashboard shows HuggingFace username and avatar
- [ ] CSRF token is fetched from backend and included in authenticated requests
- [ ] Profile endpoint returns user data only when authenticated
- [ ] Profile endpoint returns 401/403 when not authenticated
- [ ] Logout clears session and redirects to home page
- [ ] Protected routes (dashboard) redirect to login when not authenticated
- [ ] Protected routes display content when authenticated
- [ ] Tailwind styles render correctly throughout the React app
- [ ] Environment variables load properly from .env file
- [ ] Can create Django superuser for admin panel access
- [ ] No console errors in browser developer tools
- [ ] No server errors in Django logs

---

## Testing Instructions

Step-by-step manual testing procedure:

1. **Backend setup**:
   - Install UV: `curl -LsSf https://astral.sh/uv/install.sh | sh` (or `pip install uv`)
   - Create virtual environment: `uv venv`
   - Activate: `source .venv/bin/activate` (Windows: `.venv\Scripts\activate`)
   - Install dependencies: `uv pip install -r requirements.txt`
   - Create .env file with all required variables (get HuggingFace OAuth credentials from https://huggingface.co/settings/applications/new)
   - Run migrations: `python manage.py migrate`
   - Create superuser: `python manage.py createsuperuser`
   - Start Django server: `python manage.py runserver` (runs on port 8000)

2. **Frontend setup**:
   - Navigate to frontend directory
   - Install npm dependencies
   - Configure REACT_APP_API_URL if needed
   - Start React dev server on port 3000

3. **OAuth flow testing**:
   - Visit http://localhost:3000/app
   - Should see home page with login button
   - Click "Sign in with HuggingFace"
   - Should redirect to HuggingFace OAuth page
   - Log in with HuggingFace account
   - Authorize the application
   - Should redirect back to localhost:3000/app/dashboard
   - Dashboard should display your HuggingFace username and avatar

4. **Authentication testing**:
   - Verify you can see dashboard
   - Open browser dev tools, check Network tab for API calls
   - Verify CSRF token is being sent in headers
   - Click logout
   - Should redirect to home page
   - Try accessing /app/dashboard directly
   - Should redirect to login

5. **Admin testing**:
   - Visit http://localhost:8000/admin
   - Log in with superuser credentials
   - Navigate to Users
   - Find your user created via OAuth
   - Verify HuggingFace fields are populated

6. **Error handling**:
   - Test accessing protected API endpoints without authentication
   - Test with invalid CSRF token
   - Verify appropriate error messages

---

## Implementation Notes

**Why not django-allauth for HuggingFace?**  
Django-allauth is excellent but doesn't include HuggingFace as a built-in provider. While we could create a custom provider class for allauth, it's simpler to implement the OAuth flow directly using Django's built-in tools or a lightweight OAuth library. The OAuth flow is standard OAuth2 which Django can handle well.

**Session vs JWT authentication**:  
We use Django session authentication (not JWT) because in production the React app will be served from the same domain as Django (via Nginx). Session cookies are simpler, more secure (httpOnly), and avoid token refresh complexity. JWT is unnecessary for same-origin SPAs.

**CORS only needed in development**:  
CORS middleware is only active during development when React (port 3000) and Django (port 8000) are on different origins. In production, Nginx serves both from the same origin, eliminating CORS needs.

**Middleware order is critical**:  
CORS middleware must be first, followed by security middleware, then WhiteNoise. This order ensures CORS headers are set before security checks and static files are served efficiently.

**Custom User model timing**:  
The custom User model must be defined and configured (`AUTH_USER_MODEL` setting) before running the first migration. This is why it's in Feature 1 rather than being added later. Changing the user model after initial migrations is extremely difficult.

**HuggingFace access tokens**:  
Store the OAuth access token either in the User model or in the session. This token will be needed in later features to make API calls to HuggingFace Hub on behalf of the user (fetching their repos, downloading datasets, etc.).

---

## Reference Materials

Consult these documents during implementation:
- **ARCHITECTURE_TEMPLATE.md**: Django project structure, settings patterns, middleware order, CORS configuration
- **UI_DESIGN_TEMPLATE.md**: Tailwind setup, color system, typography scale, component patterns
- **HuggingFace OAuth docs**: https://huggingface.co/docs/hub/en/oauth for OAuth flow details and scopes
- **HuggingFace OpenID config**: https://huggingface.co/.well-known/openid-configuration for endpoint discovery

---

## Success Metrics

Feature 1 provides the foundation for all subsequent features. Success means:
- Clean separation between Django backend and React frontend
- Secure, working authentication flow with HuggingFace
- Proper environment configuration for development and production
- Code structure that supports adding business logic in later features
- No technical debt or shortcuts that will need refactoring later
