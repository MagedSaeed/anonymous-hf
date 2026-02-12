# CLAUDE.md

## Project Overview
Anonymous HuggingFace: a proxy service providing anonymous access to HuggingFace repositories for double-blind peer review. Users create anonymized branches on HF, submit the branch URL here, and get an anonymous proxy URL for reviewers.

## Tech Stack
- Backend: Django 5.2, DRF 3.16, Python 3.12
- Frontend: React 18, Tailwind CSS 3.4, React Router 6, Axios
- Auth: Custom HuggingFace OAuth2 (NOT django-allauth -- HF not supported)
- DB: SQLite (dev), PostgreSQL (prod)
- Package mgmt: UV (Python), npm (JS)
- Quality: Ruff (Python lint/format), ESLint + Prettier (JS), pre-commit hooks
- Testing: pytest + Factory Boy (backend), Vitest + React Testing Library (frontend)
- Task queue: Django-Q2 (ORM broker dev, Redis prod)
- Containers: Docker + Docker Compose

## Project Structure
- `backend/anonymous_hf/` -- Django project config (settings, urls, wsgi)
- `backend/core/` -- Custom User model, HF OAuth views, profile API
- `backend/anonymizer/` -- AnonymousRepo model, proxy service, API endpoints
- `frontend/src/` -- React SPA mounted at /app prefix

## Key Commands
### Backend (run from backend/)
- `uv venv && source .venv/bin/activate` -- Create/activate venv
- `uv sync` -- Install production deps
- `uv sync --extra dev` -- Install dev deps (includes production)
- `python manage.py migrate` -- Run migrations
- `python manage.py runserver` -- Dev server (port 8000)
- `pytest` -- Run tests
- `pytest --cov=. --cov-report=html` -- Tests with coverage
- `ruff check .` -- Lint
- `ruff format .` -- Format

### Frontend (run from frontend/)
- `npm install` -- Install deps
- `npm start` -- Dev server (port 3000)
- `npm test` -- Run tests
- `npm run lint` -- Lint
- `npm run format` -- Format

### Docker
- `docker compose up` -- Start all services
- `docker compose build` -- Rebuild

### Pre-commit
- `pre-commit install` -- Install hooks
- `pre-commit run --all-files` -- Run all hooks

## Architecture Decisions
- Session auth (not JWT) -- SPA same-origin via Nginx
- Custom HF OAuth (not allauth) -- no HF provider in allauth
- SPA at /app prefix -- separates from /admin, /accounts
- No file storage -- pure proxy to HF (streaming)
- CSRF cookie is NOT HttpOnly so JS can read it
- CORS only in dev (React port 3000 vs Django port 8000)
- Ownership enforced at queryset level, not Python filters

## HuggingFace OAuth Flow
1. User clicks login -> redirect to HF /oauth/authorize
2. HF redirects to /accounts/huggingface/callback/ with code
3. Backend exchanges code for tokens at /oauth/token
4. Backend fetches user info from /oauth/userinfo
5. Creates/updates User, sets session, redirects to /app/dashboard
- Scopes: openid, profile, email, read-repos
- Token format: hf_oauth_... prefix, 28800s expiry
- Supports refresh_token grant

## URL Routing
- `/app/*` -- React SPA (authenticated, with Navbar)
- `/a/{id}/*` -- Public anonymous repo viewer (no auth, no Navbar)
- `/api/*` -- Django REST API
- `/admin/` -- Django admin
- `/accounts/huggingface/*` -- OAuth login/callback

## Testing Conventions
- Backend tests: backend/core/tests/, backend/anonymizer/tests/
- Frontend tests: colocated .test.js files
- Factory Boy for model factories
- Mock HF API calls in tests (never hit real HF in tests)
- Coverage targets: 80% backend, 70% frontend

## Important Rules
- Never expose original HF repo URL to anonymous viewers
- Always stream proxy responses (never buffer entire files)
- Check repo expiry on every proxy request
- Log all anonymous access in ActivityLog
- All API endpoints require auth by default (except csrf-token, health, proxy)
- Proxy routes are at /a/{anonymous_id}/ -- public, no auth
