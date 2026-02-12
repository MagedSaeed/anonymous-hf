# Feature 0: Testing & Code Quality

**Goal**: Set up testing and code quality tools that run on every commit.

---

## Testing Frameworks

**Backend**: pytest + pytest-django + Factory Boy  
**Frontend**: Vitest + React Testing Library  
**Coverage target**: 80%+ backend, 70%+ frontend

---

## Code Quality Tools

**Python**:
- `ruff` - Linting + formatting (replaces flake8, isort, black)
- `bandit` - Security checks
- `pytest-cov` - Coverage reporting

**JavaScript**:
- `eslint` - Linting
- `prettier` - Formatting

**Docker**:
- `hadolint` - Dockerfile linting

---

## Pre-commit Hooks

Install: `uv pip install pre-commit && pre-commit install`

**What runs on every commit**:
1. Code formatting (ruff format, prettier)
2. Linting (ruff check, eslint)
3. Security checks (bandit)
4. **ALL tests** (pytest, vitest)
5. Docker linting (hadolint)

If any check fails → commit rejected.

---

## File Structure

```
backend/
├── pytest.ini                 # pytest config
├── ruff.toml                  # ruff config
└── [app]/tests/
    ├── test_models.py
    ├── test_views.py
    └── factories.py           # Factory Boy

frontend/
├── vitest.config.js
└── src/
    └── components/
        ├── Component.js
        └── Component.test.js  # Colocated tests
```

---

## Package Management: UV

**Why UV**: 10-100x faster than pip, lock files for reproducibility.

**Commands**:
```bash
uv venv                                    # Create venv
uv pip install -r requirements.txt        # Install deps
uv pip compile requirements.txt -o uv.lock  # Generate lock
```

**Files**:
- `requirements.txt` - Direct dependencies
- `uv.lock` - Lock file (commit this)
- `.venv/` - Virtual environment (don't commit)

---

## Docker Setup

**docker-compose.yml** with:
- backend (Django + Gunicorn)
- frontend (Nginx + React)
- postgres (database)
- redis (optional, sessions)

**Development**: `docker-compose up` (hot reload enabled)  
**Production**: `docker-compose -f docker-compose.yml -f docker-compose.prod.yml up`

---

## Configuration Files

**.pre-commit-config.yaml**:
```yaml
repos:
  - repo: local
    hooks:
      - id: ruff-format
      - id: ruff-check
      - id: bandit
      - id: pytest
      - id: eslint
      - id: prettier
      - id: vitest
      - id: hadolint
```

**pytest.ini**:
```ini
[pytest]
DJANGO_SETTINGS_MODULE = anonymous_hf.settings
python_files = test_*.py
addopts = --cov --cov-report=html
```

**ruff.toml**:
```toml
line-length = 100
select = ["E", "F", "I"]
```

---

## Running Tests

**Backend**: `pytest`  
**Frontend**: `npm test`  
**Coverage**: `pytest --cov` or `npm test -- --coverage`

---

## Installation Checks

Before installing, check if tools exist:
```bash
if ! command -v uv &> /dev/null; then
    curl -LsSf https://astral.sh/uv/install.sh | sh
fi
```

Similar for node, npm, docker.

---

## Acceptance Criteria

- [ ] pytest runs successfully
- [ ] Vitest runs successfully
- [ ] Pre-commit hooks installed
- [ ] Running `pre-commit run --all-files` passes
- [ ] Docker Compose starts all services
- [ ] Coverage reports generate correctly

---

## What Each Feature Must Include

Every feature (1-7) must have:
- Unit tests for new code
- Integration tests for workflows
- Factory definitions for models
- 80%+ coverage (backend), 70%+ (frontend)
- All tests pass before committing
