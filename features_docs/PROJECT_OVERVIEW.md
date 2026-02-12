# Anonymous HuggingFace - Project Overview

## Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- UV (Python package manager)
- Git with pre-commit

### Initial Setup

```bash
# 1. Check and install UV (if not present)
if ! command -v uv &> /dev/null; then
    curl -LsSf https://astral.sh/uv/install.sh | sh
fi

# 2. Check Node.js and npm
if ! command -v node &> /dev/null; then
    echo "Please install Node.js 18+ from https://nodejs.org/"
    exit 1
fi

# 3. Clone repository (when created)
git clone <repo-url>
cd anonymous-hf

# 4. Backend setup
cd backend
uv venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
uv pip install -r requirements.txt

# 5. Frontend setup
cd ../frontend
npm install

# 6. Install pre-commit hooks
cd ..
uv pip install pre-commit
pre-commit install

# 7. Configure environment
cp .env.example .env
# Edit .env with your HuggingFace OAuth credentials

# 8. Run migrations
cd backend
python manage.py migrate
python manage.py createsuperuser

# 9. Start with Docker Compose (recommended)
cd ..
docker-compose up

# OR run development servers manually:
# Terminal 1: Backend
cd backend && python manage.py runserver

# Terminal 2: Frontend
cd frontend && npm start
```

Visit: http://localhost:3000/app

---

## Project Structure

```
anonymous-hf/
├── .pre-commit-config.yaml    # Pre-commit hooks configuration
├── .env.example               # Environment variables template
├── README.md                  # This file
├── backend/
│   ├── pyproject.toml         # Python project metadata
│   ├── requirements.txt       # Production dependencies
│   ├── requirements-dev.txt   # Development dependencies
│   ├── uv.lock               # UV lock file (commit this)
│   ├── pytest.ini            # Pytest configuration
│   ├── ruff.toml             # Ruff linter configuration
│   ├── .venv/                # Virtual environment (don't commit)
│   ├── anonymous_hf/         # Django project
│   │   ├── settings.py
│   │   ├── production_settings.py
│   │   ├── urls.py
│   │   └── wsgi.py
│   ├── core/                 # Authentication app
│   │   ├── models.py         # Custom User model
│   │   ├── views.py          # OAuth views, API endpoints
│   │   ├── admin.py
│   │   └── tests/
│   └── anonymizer/           # Business logic app
│       ├── models.py         # AnonymousRepo, CachedFile, etc.
│       ├── views.py          # API endpoints
│       ├── serializers.py    # DRF serializers
│       ├── services/         # Business logic
│       │   ├── huggingface_client.py
│       │   ├── text_anonymizer.py
│       │   ├── config_anonymizer.py
│       │   └── anonymization_service.py
│       ├── admin.py
│       └── tests/
├── frontend/
│   ├── package.json
│   ├── vitest.config.js      # Vitest configuration
│   ├── tailwind.config.js    # Tailwind CSS configuration
│   ├── .eslintrc.js          # ESLint configuration
│   ├── .prettierrc           # Prettier configuration
│   └── src/
│       ├── App.js            # Router setup
│       ├── index.js
│       ├── contexts/
│       │   └── AuthContext.js
│       ├── components/
│       │   ├── Navbar/
│       │   └── ProtectedRoute/
│       └── pages/
│           ├── Home/
│           ├── Dashboard/
│           └── Login/
└── docs/
    ├── FEATURE_00_TESTING_INFRASTRUCTURE.md
    ├── FEATURE_01_PROJECT_SETUP.md
    ├── FEATURE_02_HUGGINGFACE_INTEGRATION.md
    └── FEATURE_03_ANONYMIZATION_ENGINE.md
```

---

## Feature Development Order

Implement features sequentially as they build on each other:

### ✅ Feature 0: Testing Infrastructure & Code Quality
**Status**: Foundation (implement alongside Feature 1)
- pytest + Factory Boy for backend testing
- Vitest + React Testing Library for frontend
- Ruff for linting, formatting
- Pre-commit hooks
- Coverage tracking

### ⬜ Feature 1: Project Setup & Basic Infrastructure
**Status**: First implementation
**Dependencies**: None
- Django + React setup
- HuggingFace OAuth integration
- Custom User model
- Basic API endpoints
- Authentication context

### ⬜ Feature 2: HuggingFace Integration & Data Models
**Dependencies**: Feature 1
- Database models (AnonymousRepo, CachedFile, etc.)
- HuggingFace API client
- DRF serializers
- Admin interface

### ⬜ Feature 3: Anonymization Engine
**Dependencies**: Feature 2
- Text anonymization (emails, URLs, DOIs, etc.)
- Markdown processing
- YAML/JSON config anonymization
- File type detection
- Orchestration service

### ⬜ Feature 4: API Endpoints & Views
**Dependencies**: Feature 3
- Create anonymous repo endpoint
- List user's repos
- Repo detail/update/delete
- Activity logs
- Error handling

### ⬜ Feature 5: React UI Components
**Dependencies**: Feature 4
- Anonymization form
- Repository browser
- Dashboard with stats
- Settings page

### ⬜ Feature 6: Background Task Processing
**Dependencies**: Feature 5
- Django-Q2 setup
- Async anonymization
- Progress tracking
- Scheduled cleanup

### ⬜ Feature 7: Public Anonymous Repo Viewer
**Dependencies**: Feature 6
- Public view endpoint
- File browser
- Download functionality
- Expiry handling

---

## Development Workflow

### Daily Development

1. **Start work**:
   ```bash
   # Activate virtual environment
   source backend/.venv/bin/activate
   
   # Pull latest changes
   git pull
   
   # Install any new dependencies
   uv pip sync backend/uv.lock
   cd frontend && npm install
   ```

2. **Make changes**:
   - Write code
   - Write tests
   - Run tests locally

3. **Before committing**:
   ```bash
   # Run tests
   cd backend && pytest
   cd frontend && npm test
   
   # Pre-commit hooks run automatically on commit
   git add .
   git commit -m "Your message"
   
   # If hooks fail, fix issues and commit again
   ```

### Running Tests

**Backend** (from backend directory):
```bash
# All tests
pytest

# With coverage
pytest --cov=. --cov-report=html

# Specific test file
pytest core/tests/test_models.py

# Watch mode (run tests on file changes)
pytest-watch
```

**Frontend** (from frontend directory):
```bash
# All tests
npm test

# With coverage
npm test -- --coverage

# Watch mode
npm test -- --watch
```

### Code Quality

**Backend**:
```bash
# Lint
ruff check .

# Format
ruff format .

# Type check (if using mypy)
mypy .
```

**Frontend**:
```bash
# Lint
npm run lint

# Format
npm run format
```

### Pre-commit Hooks

Hooks run automatically on `git commit`. To run manually:
```bash
pre-commit run --all-files
```

To skip hooks temporarily (not recommended):
```bash
git commit --no-verify
```

---

## Package Management with UV

### Why UV?

- ⚡ **10-100x faster** than pip
- 🔒 **Lock files** for reproducible environments (uv.lock)
- 🎯 **All-in-one**: venv + package manager
- 🔄 **pip-compatible**: Works with requirements.txt
- 📦 **Better caching**: Shares packages across projects

### Common UV Commands

```bash
# Create virtual environment
uv venv

# Install from requirements.txt
uv pip install -r requirements.txt

# Install a new package
uv pip install package-name

# Add to requirements.txt manually, then:
uv pip install -r requirements.txt

# Generate lock file (do this after changing requirements)
uv pip compile requirements.txt -o uv.lock

# Install from lock file (in CI/CD)
uv pip sync uv.lock

# Update all packages
uv pip install -r requirements.txt --upgrade
```

### Dependencies Files

**requirements.txt**: Direct dependencies for production
```
Django==5.2
djangorestframework==3.16
requests==2.32.3
PyYAML==6.0.2
```

**requirements-dev.txt**: Development tools
```
pytest==8.0.0
pytest-django==4.8.0
pytest-cov==5.0.0
factory-boy==3.3.0
ruff==0.8.0
pre-commit==4.0.0
```

**uv.lock**: Generated lock file (commit to git)
- Contains all dependencies including transitive ones
- Pins exact versions
- Ensures reproducible environments

---

## Environment Variables

Create `.env` file in project root with:

```bash
# Django
SECRET_KEY=your-secret-key-here-generate-with-get-random-secret-key
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1
DATABASE_URL=postgresql://user:pass@localhost/anonymous_hf  # Production only

# HuggingFace OAuth
HUGGINGFACE_CLIENT_ID=your-client-id
HUGGINGFACE_CLIENT_SECRET=your-client-secret
HUGGINGFACE_REDIRECT_URI=http://localhost:8000/accounts/huggingface/callback/

# CORS and CSRF (development)
CSRF_TRUSTED_ORIGINS=http://localhost:3000
CORS_ALLOWED_ORIGINS=http://localhost:3000

# Optional
HUGGINGFACE_TOKEN=your-hf-token-for-private-repos
SITE_URL=http://localhost:8000
REDIS_URL=redis://localhost:6379/1  # Production

# Superuser (for automated creation)
DJANGO_SUPERUSER_USERNAME=admin
DJANGO_SUPERUSER_EMAIL=admin@example.com
DJANGO_SUPERUSER_PASSWORD=changeme
```

---

## Testing Coverage Targets

- **Backend**: 80%+ overall, 95%+ for critical paths (auth, anonymization)
- **Frontend**: 70%+ overall, 85%+ for critical components (AuthContext)

View coverage reports:
- Backend: Open `htmlcov/index.html` after running `pytest --cov`
- Frontend: Open `coverage/index.html` after running `npm test -- --coverage`

---

## Troubleshooting

### UV Issues

**UV not found after installation**:
```bash
# Add to PATH (add to ~/.bashrc or ~/.zshrc)
export PATH="$HOME/.cargo/bin:$PATH"
source ~/.bashrc  # or ~/.zshrc
```

**Lock file out of sync**:
```bash
# Regenerate lock file
uv pip compile requirements.txt -o uv.lock
uv pip sync uv.lock
```

### Django Issues

**Migrations not applying**:
```bash
python manage.py migrate --run-syncdb
```

**Static files not loading**:
```bash
python manage.py collectstatic --noinput
```

### React Issues

**Port 3000 already in use**:
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9
```

**Module not found errors**:
```bash
rm -rf node_modules package-lock.json
npm install
```

### Pre-commit Issues

**Hooks not running**:
```bash
pre-commit install  # Reinstall hooks
```

**Hooks failing**:
```bash
# Run manually to see detailed errors
pre-commit run --all-files
```

---

## Getting Help

- **Documentation**: See `docs/` folder for feature specifications
- **Issues**: Check existing issues or create new one
- **Testing**: Refer to Feature 0 testing documentation

---

## License

[To be determined]

---

## Contributors

[To be added]
