# Anonymous HuggingFace

[![Live Demo](https://img.shields.io/badge/live-anonymous--hf.up.railway.app-success.svg?logo=railway&logoColor=white)](https://anonymous-hf.up.railway.app/app)
[![CI](https://github.com/MagedSaeed/anonymous-hf/actions/workflows/ci.yml/badge.svg)](https://github.com/MagedSaeed/anonymous-hf/actions/workflows/ci.yml)
[![Hugging Face](https://img.shields.io/badge/Hugging%20Face-Models%20%26%20Datasets-FFD21E.svg?logo=huggingface&logoColor=black)](https://huggingface.co/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Python 3.12+](https://img.shields.io/badge/python-3.12%2B-blue.svg)](https://www.python.org/)
[![Django 6.0](https://img.shields.io/badge/django-6.0-092E20.svg?logo=django&logoColor=white)](https://www.djangoproject.com/)
[![Node 20+](https://img.shields.io/badge/node-20%2B-339933.svg?logo=node.js&logoColor=white)](https://nodejs.org/)
[![React 19](https://img.shields.io/badge/react-19-61DAFB.svg?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/typescript-5.9-3178C6.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Ruff](https://img.shields.io/badge/code%20style-ruff-D7FF64.svg)](https://docs.astral.sh/ruff/)
[![Docker](https://img.shields.io/badge/docker-ready-2496ED.svg?logo=docker&logoColor=white)](docker-compose.yml)

An anonymizing service for HuggingFace repositories (models & datasets) that lets authors share their work **anonymously** — without revealing their identity — with any visitor (e.g., double-blind peer reviewers, journal editors, blog readers). Authors submit a HuggingFace branch URL; the service returns an anonymous link that streams files from HuggingFace through this service, hiding the original owner identity.

**Try it now → [anonymous-hf.up.railway.app/app](https://anonymous-hf.up.railway.app/app)**

> Originally built for academic peer review, where revealing the author's HuggingFace handle would break anonymity, but useful any time you want to share a private HuggingFace repo. HuggingFace does not offer this feature: for models and datasets, [visibility is only public or private](https://huggingface.co/docs/hub/repositories-settings#repository-visibility): *public* (anyone can find and clone it) or *private* (everyone except the owner gets `404 - Repo not found`). Protected/link-shared visibility only exists for **Spaces**, and only on PRO/Team/Enterprise plans. There's no built-in way to grant specific outside viewers anonymous, read view to a private model or dataset.

*This service is the HuggingFace counterpart to [Anonymous GitHub](https://anonymous.4open.science/). The service has been built on top of my [cookiecutter-django-react](https://github.com/MagedSaeed/cookiecutter-django-react) template.*

---

## Table of Contents

- [How it works](#how-it-works)
- [Features](#features)
- [Walkthrough: Colab + anonymous repo](#walkthrough-shipping-a-runnable-model-with-a-colab-notebook)
- [Tech stack](#tech-stack)
- [Quick start (Docker)](#quick-start-for-local-development-and-exploration-with-docker)
- [Local development](#local-development)
- [Configuration](#configuration)
- [Project layout](#project-layout)
- [URL routing](#url-routing)
- [Testing & quality](#testing--quality)
- [Production deployment](#production-deployment)
- [Architecture notes](#architecture-notes)
- [Contributing](#contributing)
- [License](#license)

---

## How it works

```
Author                    Anonymous-HF                    Visitor
  │                            │                             │
  │ 1. Sign in with HF OAuth   │                             │
  ├───────────────────────────▶│                             │
  │                            │                             │
  │ 2. Submit branch URL       │                             │
  │    (e.g. an anonymized     │                             │
  │    branch on a real repo)  │                             │
  ├───────────────────────────▶│                             │
  │                            │                             │
  │ 3. Receive anonymous URL   │                             │
  │    /a/{12-char-id}/        │                             │
  │◀───────────────────────────┤                             │
  │                            │                             │
  │     4. Share anonymous URL with visitors                 │
  │        (e.g. double-blind reviewers, journal editors)    │
  ├──────────────────────────────────────────────────────────▶│
  │                            │                             │
  │                            │ 5. Visitor browses /        │
  │                            │    downloads files          │
  │                            │◀────────────────────────────┤
  │                            │                             │
  │                            │ 6. Server streams from HF,  │
  │                            │    strips identifying info, │
  │                            │    logs activity            │
  │                            ├────────────────────────────▶│
```

The original HuggingFace URL is **never exposed** to visitors. Files are streamed in chunks; nothing is stored on this server.

## Features

- **HuggingFace OAuth login** — authors sign in with their existing HF account.
- **Anonymous shareable URLs** — random 12-character IDs (`/a/abc123def456/`).
- **Datasets and Models**.
- **File browser + viewer** — repo visitors can navigate the repo tree and preview files in the browser.
- **Streaming downloads** — files are streamed directly from hf, never cached in the server.
- **Auto-expiry** — repos expire after a configurable number of days.
- **Manual controls** — owners can extend, expire, or soft-delete a repo from the dashboard.
- **Activity logging** — every view, download, and admin action is logged with actor type (anonymous / non-owner / owner).
- **Optional Colab link** — attach a notebook URL alongside the repo to show visitors how they can interact with your work.
- **Public viewer** — visitors don't need an account to browse or download.

## Walkthrough: shipping a runnable model with a Colab notebook

A common reviewer comment is *"the paper claims X, but I can't reproduce it."* or *"the model and dataset is not publickly available to experiment with it."* The optional **Colab link** feature on each repo allows you to attach a notebook that loads files directly from the anonymous URL, so visitors can run your model in one click and interact with it without ever seeing your HuggingFace handle and breaking the anonymity.

**1) As the author** — push a fine-tuned model or a dataset to a HuggingFace branch, submit the branch URL here, and you'll get a shareable viewer URL like `https://anonymous-hf.up.railway.app/a/{id}/`.

**2) Create a Colab notebook** that pulls the repo from the matching API endpoint (`/api/a/{id}/download/`) and loads it with the standard HuggingFace tooling — three lines for a dataset, four for a model:

```python
# Download the repository
!wget "https://anonymous-hf.up.railway.app/api/a/{id}/download/" -O repo.zip
!unzip repo.zip -d anonymous_repo

# Load it like any local HF dataset
import datasets
# Second arg is a config/subset name — only pass it when the dataset has
# multiple configs or a custom loading script. Omit it for single-config datasets.
ds = datasets.load_dataset("anonymous_repo", "all_shuffled")
# DatasetDict({ test: Dataset({ features: ['text', 'source'], num_rows: 5000 }) })

# Or for a model checkpoint
from transformers import AutoTokenizer, AutoModelForSequenceClassification
tok = AutoTokenizer.from_pretrained("anonymous_repo")
mdl = AutoModelForSequenceClassification.from_pretrained("anonymous_repo")
```

**3) Paste the Colab URL** into the *Colab link* field on the repo's detail page. The public viewer renders an **Open in Colab** badge so visitors land in a runnable notebook with a single click.

## Tech stack

- **Backend** — Django 6.0 + DRF 3.16, Python 3.12+ ([UV](https://docs.astral.sh/uv/)), custom HuggingFace OAuth2 (no `django-allauth` — HF isn't a built-in provider), Django-Q2, SQLite (dev) / PostgreSQL (prod).
- **Frontend** — React 19 + TypeScript 5.9, Vite 7.3, Tailwind CSS 4.1, React Router 7.
- **Infra** — Docker Compose (dev + prod), Nginx for the SPA, Gunicorn + WhiteNoise for Django.
- **Quality** — Ruff (Python), ESLint + Prettier (TS), pytest + Factory Boy + `responses`, Vitest + React Testing Library.

## Quick start for local development and exploration (with Docker)

The fastest way to try it:

```bash
git clone https://github.com/MagedSaeed/anonymous-hf.git
cd anonymous-hf
cp .env.example .env
# Edit .env and add your HUGGINGFACE_CLIENT_ID / HUGGINGFACE_CLIENT_SECRET
docker compose up
```

Then open:
- http://localhost:3000 — frontend
- http://localhost:8000/admin/ — Django admin

You'll need HuggingFace OAuth credentials. Create an OAuth app at https://huggingface.co/settings/applications/new with redirect URI `http://localhost:8000/accounts/huggingface/callback/`.

## Local development

Requires Python 3.12+, Node 20+, and [UV](https://docs.astral.sh/uv/getting-started/installation/).

```bash
# Backend  →  http://localhost:8000
cd backend
uv sync --extra dev
uv run python manage.py migrate
uv run python manage.py runserver

# Frontend →  http://localhost:3000  (proxies /api and /accounts to :8000)
cd frontend
npm install
npm run dev
```

## Configuration

All configuration lives in `.env` at the repo root. Copy `.env.example` to `.env` and fill in the values.

| Variable | Required | Notes |
| --- | --- | --- |
| `SECRET_KEY` | yes | Django secret key. Generate one with `python -c 'import secrets; print(secrets.token_urlsafe(64))'`. |
| `DEBUG` | yes | `True` for dev, `False` for prod. |
| `ALLOWED_HOSTS` | yes | Comma-separated host list. |
| `HUGGINGFACE_CLIENT_ID` | yes | From your HF OAuth app. |
| `HUGGINGFACE_CLIENT_SECRET` | yes | From your HF OAuth app. |
| `HUGGINGFACE_REDIRECT_URI` | yes | Must match the OAuth app exactly. |
| `DATABASE_URL` | prod | `postgresql://user:pass@host:5432/db`. Dev uses SQLite. |
| `REDIS_URL` | prod | Used for Django-Q2 broker and cache. |
| `CSRF_TRUSTED_ORIGINS` | dev | CSV of frontend origins. |
| `CORS_ALLOWED_ORIGINS` | dev | CSV; only needed when frontend port differs from backend. |
| `FRONTEND_URL` | prod | Public origin of the SPA; builds `LOGIN_REDIRECT_URL` / `LOGOUT_REDIRECT_URL`. Defaults to `http://localhost:3000` in dev. |

OAuth scopes requested: `openid profile email read-repos`.

## Project layout

```
anonymous-hf/
├── backend/
│   ├── anonymous_hf/             # Django project (settings, urls, wsgi)
│   ├── core/                     # Custom User model + HF OAuth views
│   ├── anonymizer/
│   │   ├── models.py             # AnonymousRepo, ActivityLog
│   │   ├── views.py              # Authenticated CRUD endpoints
│   │   ├── proxy_views.py        # Public proxy endpoints (file streaming, tree)
│   │   ├── services/
│   │   │   └── huggingface_client.py   # HF API integration
│   │   └── tests/
│   ├── conftest.py               # pytest fixtures: user, authenticated_client
│   └── pyproject.toml
├── frontend/
│   └── src/
│       ├── pages/                # Dashboard, CreateRepo, RepoDetails, PublicViewer, ...
│       ├── components/           # FileBrowser, FileViewer, Navbar, ...
│       └── contexts/             # AuthContext, ThemeContext
├── docker-compose.yml            # Dev: backend + frontend
├── docker-compose.prod.yml       # Prod: + PostgreSQL + Redis + healthchecks
├── .env.example
└── CLAUDE.md                     # Notes for AI coding assistants
```

## URL routing

| Path | Purpose | Auth |
| --- | --- | --- |
| `/app/*` | React SPA (dashboard, settings, repo creation) | Required |
| `/a/{anonymous_id}/*` | Public anonymous viewer + file streaming | None |
| `/api/*` | Django REST API | Required (except health, csrf-token) |
| `/admin/` | Django admin | Staff |
| `/accounts/huggingface/*` | OAuth login + callback | None |

The SPA is mounted at `/app` so it's clearly separated from the `/admin` and OAuth routes.

## Testing & quality

```bash
# Backend
cd backend
uv run pytest                          # tests (use --cov=. --cov-report=html for coverage)
uv run ruff check . && uv run ruff format .

# Frontend
cd frontend
npm test -- --run                      # tests
npm run lint && npx tsc --noEmit       # lint + types

# All pre-commit hooks
pre-commit run --all-files
```

HuggingFace API calls are mocked via the `responses` library — tests **never** hit the real HF API.

## Production deployment

`docker-compose.prod.yml` brings up the full stack with PostgreSQL and Redis:

```bash
cp .env.example .env
# Set DEBUG=False, real SECRET_KEY, real ALLOWED_HOSTS, POSTGRES_PASSWORD, etc.
docker compose -f docker-compose.prod.yml up -d
```

Production specifics:
- Django uses `anonymous_hf.production_settings`.
- Nginx (in the frontend container) serves the SPA build at `/` and proxies `/api/`, `/accounts/`, `/admin/`, and `/static/` to the backend. WhiteNoise serves Django's static assets (admin, DRF browsable API) behind that `/static/` proxy.
- Health check endpoint: `GET /api/health/` (used by the backend container's healthcheck).
- Postgres and Redis volumes persist data between restarts.

You'll likely want to put a TLS-terminating reverse proxy (Caddy, Traefik, or Nginx) in front of the frontend container.

## Architecture notes

A few decisions that aren't obvious from the code alone:

- **Streaming-only, no storage.** `proxy_views.py` returns a `StreamingHttpResponse` that pulls 8KB chunks from `huggingface.co/{type}s/{repo}/resolve/{branch}/{path}` on demand. Bandwidth is the main cost, not storage.
- **Soft delete + auto-expiry.** Deleted repos keep `status="deleted"` so audit logs survive; `expires_at` is auto-populated from `owner.default_expiry_days` on save.
- **Ownership enforced at the queryset.** API views filter via `.filter(owner=request.user)` rather than checking ownership in Python — fewer ways to forget the check.
- **Session auth, not JWT.** SPA is same-origin, so cookies work without token plumbing. The CSRF cookie is intentionally **not** HttpOnly so the React app can read it for fetch headers.

## Contributing

Fork → branch → `pre-commit install` → write tests → run the lint/test commands above → open a PR. CI runs the same commands, so make sure they pass locally first.

## License

This project is released under the [MIT License](LICENSE).
