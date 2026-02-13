FROM python:3.13-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Install dependencies
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

# Copy application code
COPY backend .

# Collect static files
RUN uv run python manage.py collectstatic --noinput 2>/dev/null || true

EXPOSE 8000

CMD ["uv", "run", "gunicorn", "anonymous_hf.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "4", "--timeout", "120"]
