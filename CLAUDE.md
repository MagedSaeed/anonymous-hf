# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
Anonymous HuggingFace: a proxy service providing anonymous access to HuggingFace repositories for double-blind peer review. Users create anonymized branches on HF, submit the branch URL here, and get an anonymous proxy URL for reviewers.

## Tech Stack
- Backend: Django 6.0.2, DRF 3.16.1, Python 3.12+
- Frontend: React 19, TypeScript 5.9, Vite 7.3, Tailwind CSS 4.1, React Router 7, Axios
- Auth: Custom HuggingFace OAuth2 (NOT django-allauth -- HF not supported)
- DB: SQLite (dev), PostgreSQL 16 (prod)
- Package mgmt: UV with pyproject.toml (Python), npm (JS)
- Quality: Ruff (Python lint/format), ESLint + typescript-eslint + Prettier (JS/TS)
- Testing: pytest + Factory Boy (backend), Vitest + React Testing Library (frontend)
- Task queue: Django-Q2 (ORM broker dev, Redis prod)
- Containers: Docker + Docker Compose

## Project Structure
- `backend/anonymous_hf/` -- Django project config (settings, urls, wsgi)
- `backend/core/` -- Custom User model (`AUTH_USER_MODEL = "core.User"`), HF OAuth views, profile API
- `backend/anonymizer/` -- AnonymousRepo model, proxy service, API endpoints
- `backend/anonymizer/services/huggingface_client.py` -- HF API integration (URL parsing, repo validation, tree listing, streaming)
- `backend/anonymizer/proxy_views.py` -- Public proxy endpoints (file streaming, tree, download)
- `frontend/src/` -- React SPA with TypeScript, mounted at /app prefix
- `frontend/src/contexts/` -- AuthContext (user state), ThemeContext (dark mode)
- `frontend/src/pages/` -- Route pages (Dashboard, CreateRepo, RepoDetails, PublicViewer, Settings, etc.)
- `frontend/src/components/` -- Reusable components (FileBrowser, FileViewer, Navbar, etc.)

## Key Commands

### Backend (run from backend/)
- `uv sync --extra dev` -- Install all deps (dev includes production)
- `uv run python manage.py migrate` -- Run migrations
- `uv run python manage.py runserver` -- Dev server (port 8000)
- `uv run pytest` -- Run all tests
- `uv run pytest path/to/test_file.py::TestClass::test_method` -- Run single test
- `uv run pytest --cov=. --cov-report=html` -- Tests with coverage
- `uv run ruff check .` -- Lint
- `uv run ruff format .` -- Format

### Frontend (run from frontend/)
- `npm install` -- Install deps
- `npm run dev` -- Dev server (port 3000, proxies /api and /accounts to backend)
- `npm test` -- Run tests (Vitest)
- `npm run lint` -- Lint (ESLint)
- `npx tsc --noEmit` -- Type check only
- `npm run build` -- Type check + production build

### Docker
- `docker compose up` -- Start dev services (backend + frontend)
- `docker compose -f docker-compose.prod.yml up` -- Production (adds PostgreSQL + Redis)

### Pre-commit
- `pre-commit run --all-files` -- Run all hooks

## Architecture Decisions
- Session auth (not JWT) -- SPA same-origin via Nginx
- Custom HF OAuth (not allauth) -- no HF provider in allauth
- SPA at /app prefix -- separates from /admin, /accounts
- No file storage -- pure proxy to HF (streaming with 8KB chunks via `StreamingHttpResponse`)
- CSRF cookie is NOT HttpOnly so JS can read it
- CORS only in dev (React port 3000 vs Django port 8000)
- Ownership enforced at queryset level (`.filter(owner=request.user)`), not Python filters
- Soft-delete pattern: `status="deleted"`, not actual deletion
- AnonymousRepo.expires_at auto-set from owner.default_expiry_days in save()
- Frontend uses `<Outlet />` pattern for nested routes (ProtectedRoute is a layout route)
- Tailwind v4: `@import "tailwindcss"` in index.css (font imports BEFORE tailwind import)

## URL Routing
- `/app/*` -- React SPA (authenticated, with Navbar)
- `/a/{id}/*` -- Public anonymous repo viewer (no auth, no Navbar)
- `/api/*` -- Django REST API
- `/admin/` -- Django admin
- `/accounts/huggingface/*` -- OAuth login/callback

## HuggingFace OAuth Flow
1. User clicks login -> redirect to HF /oauth/authorize
2. HF redirects to /accounts/huggingface/callback/ with code
3. Backend exchanges code for tokens at /oauth/token
4. Backend fetches user info from /oauth/userinfo
5. Creates/updates User, sets session, redirects to /app/dashboard
- Scopes: openid, profile, email, read-repos
- Token format: hf_oauth_... prefix, 28800s expiry

## Testing Conventions
- Backend tests: `backend/core/tests/`, `backend/anonymizer/tests/`
- Frontend tests: colocated `.test.tsx` files
- Factory Boy for model factories (`core/factories.py`, `anonymizer/factories.py`)
- `conftest.py` at backend root provides `user` and `authenticated_client` fixtures
- Mock HF API calls in tests (never hit real HF in tests, use `responses` library)
- pytest config in `pyproject.toml`: addopts `-v --tb=short`

## Important Rules
- Never expose original HF repo URL to anonymous viewers
- Always stream proxy responses (never buffer entire files)
- Check repo expiry on every proxy request
- Log all anonymous access in ActivityLog
- All API endpoints require auth by default (except csrf-token, health, proxy)
- Proxy routes are at /a/{anonymous_id}/ -- public, no auth

## Ruff Configuration
- Line length: 100, double quotes, select: E/F/I/W, ignore E501
