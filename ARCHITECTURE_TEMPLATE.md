# Architecture Template

> Reusable architecture blueprint extracted from CoReview. This documents the technology choices, patterns, and conventions to replicate across new Django + React SPA projects. Replace `{APP_NAME}`, `{app_name}`, and `{domain_app}` with your project-specific names.

## Stack Summary

| Layer | Technology | Version | Rationale |
|-------|-----------|---------|-----------|
| Backend Framework | Django | 5.2 | Batteries-included: ORM, admin, auth, migrations, middleware. Mature ecosystem. |
| API Layer | Django REST Framework | 3.16 | Serializers, viewsets, permission classes, content negotiation. |
| Authentication | django-allauth | 65+ | Social auth (Google OAuth2) with zero custom OAuth code. |
| Frontend | React | 18+ | Component model, hooks, large ecosystem. |
| Styling | Tailwind CSS | 3.4 | Utility-first, no CSS-in-JS runtime, co-located styles. |
| Routing | React Router | 6+ | Declarative routing with basename support for sub-path mounting. |
| HTTP Client | Axios | 1.7 | `withCredentials` support, interceptors, clean API. |
| Task Queue | Django-Q2 | 1.8 | ORM broker for dev (no Redis needed), Redis broker for prod. |
| Config | python-decouple | — | `.env` file parsing, type casting, defaults. |
| Static Files | WhiteNoise | 6+ | Compressed static serving without Nginx in dev. |
| DB (dev) | SQLite | — | Zero config, file-based, sufficient for solo development. |
| DB (prod) | PostgreSQL | — | Via `dj_database_url`. Robust, concurrent, production-grade. |
| Cache (prod) | Redis + django-redis | — | Cache backend + Django-Q broker in one service. |
| Process Manager | Gunicorn | — | Production WSGI server with worker management. |
| Reverse Proxy | Nginx | — | Static files, SSL termination, API proxying. |
| Containers | Docker | — | Reproducible builds, isolated services. |

## Project Structure

```
{app_name}/
├── backend/
│   ├── {app_name}/                  # Django project config
│   │   ├── settings.py              # Development settings
│   │   ├── production_settings.py   # Production overrides (imports from settings.py)
│   │   ├── urls.py                  # Root URL routing
│   │   └── wsgi.py                  # WSGI entry point
│   ├── core/                        # User model & authentication
│   │   ├── models.py                # Custom User model
│   │   ├── adapters.py              # Social auth redirect adapter
│   │   └── management/commands/     # setup_google_oauth, setup_superuser
│   ├── {domain_app}/                # Core business logic app
│   │   ├── models.py                # Domain models
│   │   ├── views.py                 # API views
│   │   ├── serializers.py           # DRF serializers
│   │   ├── urls.py                  # App URL routing
│   │   ├── tasks.py                 # Background task definitions
│   │   └── admin.py                 # Admin customizations
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── Dockerfile.qcluster          # Separate container for task workers
│   └── start-django.sh              # Startup script for containers
├── frontend/
│   ├── src/
│   │   ├── App.js                   # Router setup
│   │   ├── index.js                 # React root
│   │   ├── index.css                # Tailwind + global styles
│   │   ├── contexts/
│   │   │   └── AuthContext.js       # Global auth state, CSRF, API helpers
│   │   ├── components/              # Shared components
│   │   └── pages/                   # Route-level components
│   ├── package.json
│   ├── tailwind.config.js
│   ├── Dockerfile
│   ├── nginx.conf.template
│   └── start-nginx.sh
├── .env.example
├── CLAUDE.md
└── README.md
```

## Backend Architecture

### Django Settings Split

**`settings.py`** (development):
- `DEBUG = True`
- SQLite database
- `CORS_ALLOWED_ORIGINS = ["http://localhost:3000"]`
- `CSRF_COOKIE_HTTPONLY = False` (allows JS to read the token)
- `SESSION_COOKIE_SECURE = False`
- Django-Q with ORM broker (no Redis dependency)
- In-memory cache (LocMemCache)

**`production_settings.py`** (extends base):
```python
from .settings import *

DEBUG = False
DATABASES = {'default': dj_database_url.parse(config('DATABASE_URL'))}
CACHES = {'default': {'BACKEND': 'django_redis.cache.RedisCache', ...}}
SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
USE_X_FORWARDED_HOST = True
```

**Key middleware order** (CORS must be first):
```python
MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',          # 1. CORS headers
    'django.middleware.security.SecurityMiddleware',   # 2. Security
    'whitenoise.middleware.WhiteNoiseMiddleware',      # 3. Static files
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'allauth.account.middleware.AccountMiddleware',
]
```

### Custom User Model

Always define a custom User model from day one (even if it just extends AbstractUser):

```python
# core/models.py
from django.contrib.auth.models import AbstractUser

class User(AbstractUser):
    # Add project-specific fields here
    # e.g., api_key, organization, preferences
    pass
```

```python
# settings.py
AUTH_USER_MODEL = 'core.User'
```

### API Design Conventions

**Default authentication**: All endpoints require login.
```python
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.SessionAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
}
```

**URL structure**: All API endpoints under `/api/`.
```python
# {app_name}/urls.py
urlpatterns = [
    path('admin/', admin.site.urls),
    path('accounts/', include('allauth.urls')),
    path('api/', include('{domain_app}.urls')),
    path('api/', include('core.urls')),  # profile, csrf-token
]
```

**Ownership enforcement** at queryset level (not in Python filters):
```python
class ItemListCreateView(generics.ListCreateAPIView):
    def get_queryset(self):
        return Item.objects.filter(owner=self.request.user)

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)
```

**Object-level ownership** for detail views:
```python
item = get_object_or_404(Item, id=item_id, owner=request.user)
```

**Serializer immutability pattern** (make fields read-only on update):
```python
class ItemSerializer(serializers.ModelSerializer):
    def get_fields(self):
        fields = super().get_fields()
        if self.instance is not None:  # Update operation
            fields['item_type'].read_only = True
        return fields
```

**Sensitive field masking**:
```python
class UserSerializer(serializers.ModelSerializer):
    api_key_masked = serializers.SerializerMethodField()

    class Meta:
        model = User
        extra_kwargs = {'api_key': {'write_only': True}}

    def get_api_key_masked(self, obj):
        if obj.api_key and len(obj.api_key) > 8:
            return f"{obj.api_key[:4]}{'*' * (len(obj.api_key) - 8)}{obj.api_key[-4:]}"
        return ''
```

### Error Handling Pattern

Standard view error handling:
```python
class SomeView(APIView):
    def post(self, request):
        try:
            # Business logic
            return Response(data, status=status.HTTP_200_OK)
        except SpecificException as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
```

For background tasks, use three layers:
1. **Task function**: `try/except` saves error to model
2. **Task hook**: Catches worker-level failures (timeouts, crashes)
3. **View layer**: Catches queuing failures

### Admin Customizations

Always customize admin for key models:
```python
@admin.register(Item)
class ItemAdmin(admin.ModelAdmin):
    list_display = ('title', 'colored_status', 'owner', 'created_at')
    list_filter = ('status', 'created_at')
    search_fields = ('title',)
    readonly_fields = ('created_at', 'updated_at')

    def colored_status(self, obj):
        colors = {'completed': 'green', 'pending': 'orange', 'failed': 'red'}
        color = colors.get(obj.status, 'black')
        return format_html(
            '<span style="color: {}; font-weight: bold;">{}</span>',
            color, obj.status
        )

    fieldsets = (
        ('Basic', {'fields': ('title', 'owner', 'status')}),
        ('Details', {'fields': ('content',), 'classes': ('collapse',)}),
        ('Timestamps', {'fields': ('created_at', 'updated_at'), 'classes': ('collapse',)}),
    )
```

## Frontend Architecture

### State Management: Context + Local State

No Redux/Zustand. Use React Context for truly global state, local state for everything else:

| Scope | Mechanism | Examples |
|-------|-----------|---------|
| Global | `AuthContext` | User object, auth status, CSRF token, profile CRUD |
| Page-level | `useState` in page component | Page data, active tab, list filters |
| Component-level | `useState` in component | Form inputs, collapsed state, loading flags |

### AuthContext Blueprint

```jsx
const AuthContext = createContext();

const API_BASE_URL = process.env.REACT_APP_API_URL || '';

function getCSRFToken() {
  const cookies = document.cookie.split(';');
  for (let cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === 'csrftoken') return value;
  }
  return null;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Fetch CSRF token, then check auth
    axios.get(`${API_BASE_URL}/api/csrf-token/`, { withCredentials: true })
      .then(() => checkAuthStatus())
      .catch(() => setLoading(false));
  }, []);

  const checkAuthStatus = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/profile/`, {
        withCredentials: true
      });
      setUser(res.data);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  // Provide helper for authenticated requests
  const apiCall = (method, url, data) => {
    return axios({
      method,
      url: `${API_BASE_URL}${url}`,
      data,
      withCredentials: true,
      headers: { 'X-CSRFToken': getCSRFToken() },
    });
  };

  return (
    <AuthContext.Provider value={{ user, loading, apiCall, checkAuthStatus }}>
      {children}
    </AuthContext.Provider>
  );
}
```

### Routing Blueprint

```jsx
// App.js
function App() {
  return (
    <AuthProvider>
      <Router basename="/app">
        <div className="min-h-screen bg-gray-50">
          <Navbar />
          <main className="container mx-auto px-4 py-8">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/dashboard" element={
                <ProtectedRoute><DashboardPage /></ProtectedRoute>
              } />
              {/* More routes */}
            </Routes>
          </main>
        </div>
      </Router>
    </AuthProvider>
  );
}
```

**Build config** in `package.json`:
```json
{
  "scripts": {
    "start": "PUBLIC_URL=/app react-scripts start",
    "build": "PUBLIC_URL=/app react-scripts build"
  }
}
```

### Auto-Save Pattern

For forms with debounced auto-save (useful for long-form editing):

```jsx
const saveTimerRef = useRef({});

const saveFieldValue = async (fieldName, value) => {
  // Clear existing timer
  if (saveTimerRef.current[fieldName]) {
    clearTimeout(saveTimerRef.current[fieldName]);
  }

  // Set new timer (2 second debounce)
  saveTimerRef.current[fieldName] = setTimeout(async () => {
    setSaveStatus(prev => ({ ...prev, [fieldName]: 'saving' }));
    try {
      await apiCall('PATCH', `/api/items/${id}/`, { [fieldName]: value });
      setSaveStatus(prev => ({ ...prev, [fieldName]: 'saved' }));
    } catch {
      setSaveStatus(prev => ({ ...prev, [fieldName]: 'error' }));
    }
  }, 2000);
};
```

### localStorage Persistence

Use for UX state that should survive page refreshes:
- Collapsed/expanded section states
- User preferences (sort order, view mode)
- Cached non-sensitive data (with TTL)

```jsx
// Read with fallback
const [collapsed, setCollapsed] = useState(() => {
  try { return JSON.parse(localStorage.getItem('section_collapsed')) ?? false; }
  catch { return false; }
});

// Write on change
useEffect(() => {
  localStorage.setItem('section_collapsed', JSON.stringify(collapsed));
}, [collapsed]);
```

## Authentication

### Google OAuth2 Flow

```
1. User clicks "Sign in with Google"
   → Navigate to /accounts/google/login/

2. django-allauth → Google consent screen
   → User grants profile + email scope

3. Google → /accounts/google/login/callback/
   → allauth creates/updates User, sets session cookie

4. CustomSocialAccountAdapter redirects
   → /app/dashboard (configurable via LOGIN_REDIRECT_URL)

5. React AuthContext → GET /api/profile/
   → Session cookie authenticates the request
```

### Session + CSRF Cookie Configuration

| Cookie | Dev | Prod | Purpose |
|--------|-----|------|---------|
| `sessionid` | HttpOnly, SameSite=Lax | HttpOnly, Secure, SameSite=Lax | Session auth |
| `csrftoken` | **Not** HttpOnly, SameSite=Lax | **Not** HttpOnly, Secure, SameSite=Lax | CSRF for SPA |

The CSRF cookie is **not** HttpOnly so JavaScript can read it and send it as `X-CSRFToken` header.

### CSRF Token Lifecycle

```
1. App mounts → GET /api/csrf-token/        (sets csrftoken cookie)
2. Before each mutating request:
   a. Read csrftoken from document.cookie
   b. Attach as X-CSRFToken header
3. Django CSRF middleware validates match
```

**Django view for SPA CSRF token**:
```python
class CSRFTokenView(APIView):
    permission_classes = []  # Public endpoint

    def get(self, request):
        return Response({'detail': 'CSRF cookie set'})
```

### Why Session Auth over JWT

- SPA is served from the same origin as API (via Nginx proxy) — no cross-origin token issues
- Sessions are server-revocable (logout invalidates immediately)
- No client-side token refresh logic needed
- Simpler implementation, fewer moving parts
- HttpOnly session cookies are more secure than localStorage JWT tokens

## Background Task Processing

### Django-Q2 Setup

**Development** (zero dependencies — ORM broker):
```python
Q_CLUSTER = {
    'name': '{app_name}_dev',
    'workers': 4,
    'timeout': 600,       # 10 minutes
    'retry': 660,
    'orm': 'default',     # Use database as broker
}
```

**Production** (Redis broker):
```python
Q_CLUSTER = {
    'name': '{app_name}_production',
    'workers': config('DJANGO_Q_WORKERS', default=8, cast=int),
    'timeout': config('DJANGO_Q_TIMEOUT', default=900, cast=int),
    'retry': config('DJANGO_Q_RETRY', default=960, cast=int),
    'django_redis': 'default',
    'max_attempts': 2,
    'ack_failures': True,
    'save_limit': 1000,
}
```

### Sync-first, Async-ready Pattern

Start synchronous (simpler debugging, immediate results), with async infrastructure ready:

```python
# tasks.py
def process_item_task(item_id):
    """Can be called directly (sync) or via async_task()."""
    item = Item.objects.get(id=item_id)
    try:
        # Processing logic
        item.status = 'completed'
        item.save()
    except Exception as e:
        item.status = 'failed'
        item.error_message = str(e)
        item.save()

def queue_item_processing(item_id):
    """Switch to this when ready for async."""
    return async_task(
        '{domain_app}.tasks.process_item_task',
        item_id,
        hook='{domain_app}.tasks.item_task_hook',
        timeout=600,
    )

def item_task_hook(task):
    """Catches worker-level failures."""
    if not task.success:
        try:
            item = Item.objects.get(id=task.args[0])
            item.status = 'failed'
            item.error_message = f"Task failed: {task.result}"
            item.save()
        except Item.DoesNotExist:
            pass
```

**In the view** — swap one function call to go async:
```python
# Synchronous (current):
process_item_task(item.id)

# Asynchronous (when needed):
task_id = queue_item_processing(item.id)
```

## Caching Strategy

### Layer 1: Application Cache

Cache expensive external API calls:
```python
class ExternalDataView(APIView):
    def get(self, request):
        cached = cache.get('external_data')
        if cached:
            return Response(cached)

        data = fetch_from_external_api()
        cache.set('external_data', data, 3600)  # 1 hour
        return Response(data)
```

### Layer 2: Frontend localStorage

Cache non-sensitive data with TTL:
```javascript
function getCachedData(key, maxAgeMs = 7 * 24 * 60 * 60 * 1000) {
  const cached = localStorage.getItem(key);
  if (cached) {
    const { data, timestamp } = JSON.parse(cached);
    if (Date.now() - timestamp < maxAgeMs) return data;
  }
  return null;
}
```

### Layer 3: Nginx Static Caching (Production)

```nginx
location ^~ /app {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

## Database Conventions

### Model Patterns

```python
class BaseModel(models.Model):
    """Abstract base for all domain models."""
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True
```

### Key Constraints

- **Unique together**: Prevent duplicate data at the DB level, not in application code
- **Foreign key cascades**: Use `on_delete=CASCADE` for parent-child relationships
- **Field validators**: Enforce business rules as model validators (`validators=[...]`)
- **One-way flags**: For irreversible state transitions, set `True` once and never revert

### Query Optimization

- Use `select_related()` for foreign keys accessed in list views and admin
- Filter at queryset level (`objects.filter(...)`) not in Python
- Use `order_by('-created_at')` consistently for deterministic pagination

## Security Checklist

### Authentication & Authorization
- [ ] Custom User model from day one
- [ ] All API endpoints require authentication by default
- [ ] Ownership verified at queryset level (not Python-level)
- [ ] Session-based auth with Secure + HttpOnly cookies in production

### CSRF & CORS
- [ ] CSRF middleware enabled
- [ ] CSRF cookie not HttpOnly (for SPA JS access)
- [ ] CORS explicitly allowlists origins (no wildcards)
- [ ] `CORS_ALLOW_CREDENTIALS = True` for cookie-based auth

### File Uploads (if applicable)
- [ ] Extension check (application-level)
- [ ] MIME type check via `python-magic` (prevents extension spoofing)
- [ ] Size limit enforced
- [ ] Files served through auth-gated views, not direct URLs

### Production Hardening
- [ ] `SECURE_SSL_REDIRECT = True`
- [ ] `SESSION_COOKIE_SECURE = True`
- [ ] `CSRF_COOKIE_SECURE = True`
- [ ] `SECURE_PROXY_SSL_HEADER` configured for reverse proxy
- [ ] Nginx headers: X-Frame-Options, X-Content-Type-Options, X-XSS-Protection
- [ ] Non-root container user

### Sensitive Data
- [ ] API keys stored write-only in serializers, shown only as masked values
- [ ] `.env` files in `.gitignore`
- [ ] No secrets in Docker build args or image layers

## Deployment Architecture

### Three-Container Model

```
┌─────────────────┐  ┌──────────────┐  ┌──────────────┐
│   Frontend       │  │   Backend     │  │   QCluster    │
│   Nginx + React  │  │   Gunicorn    │  │   Django-Q    │
│   Port 80        │  │   Port 8080   │  │   Worker      │
└────────┬─────────┘  └──────┬───────┘  └──────┬───────┘
         │                    │                  │
         └────────────────────┼──────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │   PostgreSQL       │
                    │   Redis            │
                    └───────────────────┘
```

### Backend Dockerfile

```dockerfile
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV DJANGO_SETTINGS_MODULE={app_name}.production_settings

WORKDIR /app

# System deps
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        postgresql-client build-essential libpq-dev libmagic1 \
    && rm -rf /var/lib/apt/lists/*

# Python deps
COPY backend/requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt

COPY backend /app/

# Non-root user
RUN adduser --disabled-password --gecos '' appuser
RUN mkdir -p /app/logs /app/data/static /app/data/media
RUN chown -R appuser:appuser /app
RUN chmod +x /app/start-django.sh

USER appuser
ENV PORT=8080
EXPOSE $PORT
CMD ["/app/start-django.sh"]
```

### Startup Script (`start-django.sh`)

```bash
#!/bin/bash
set -e

python manage.py migrate
python manage.py collectstatic --noinput
python manage.py setup_google_oauth
python manage.py setup_superuser

exec gunicorn \
    --bind [::]:${PORT:-8080} \
    --timeout 120 \
    --workers 2 \
    --threads 2 \
    --worker-connections 1000 \
    --max-requests 10 \
    --max-requests-jitter 100 \
    --access-logfile - \
    --error-logfile - \
    {app_name}.wsgi:application
```

**Gunicorn settings rationale**:
- Workers: 2 (for 1-2 CPU containers; use `2 * cores + 1` for larger)
- Threads: 2 per worker (handles I/O-bound requests concurrently)
- Timeout: 120s (increase if processing long-running requests)
- Max requests: 10 + jitter (recycles workers to prevent memory leaks)
- Bind `[::]` (IPv6) for Railway/Cloud Run compatibility

### Nginx Configuration (`nginx.conf.template`)

```nginx
worker_processes auto;
events { worker_connections 1024; }

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;
    client_max_body_size 5M;

    # Dynamic backend resolution
    resolver [fd12::10]:53 valid=10s;  # Adjust DNS for your platform

    server {
        listen 80;

        # React SPA
        location ^~ /app {
            alias /usr/share/nginx/html/;
            try_files $uri $uri/ @react_fallback;
            location ~* \.(js|css|png|jpg|svg|ico|woff2?)$ {
                expires 1y;
                add_header Cache-Control "public, immutable";
            }
        }
        location @react_fallback {
            root /usr/share/nginx/html;
            try_files /index.html =404;
        }

        # Django static files
        set $backend ${BACKEND_URL};
        location ^~ /static/ {
            proxy_pass http://$backend$request_uri;
            expires 1y;
            add_header Cache-Control "public, immutable";
        }

        # API + Admin + OAuth
        location / {
            proxy_pass http://$backend$request_uri;
            proxy_set_header Host $http_host;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto https;
            proxy_set_header X-Forwarded-Host $http_host;
            proxy_read_timeout 300s;
            proxy_connect_timeout 75s;
        }

        # Security headers
        add_header X-Frame-Options DENY;
        add_header X-Content-Type-Options nosniff;
        add_header X-XSS-Protection "1; mode=block";
    }

    gzip on;
    gzip_types text/plain text/css application/javascript application/json;
}
```

### Frontend Dockerfile

```dockerfile
FROM node:18-alpine

RUN apk add --no-cache nginx gettext

WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci --only=production
COPY frontend/ .

ARG REACT_APP_API_URL
RUN npm run build

RUN mkdir -p /usr/share/nginx/html
RUN cp -r build/* /usr/share/nginx/html/
COPY frontend/nginx.conf.template /etc/nginx/nginx.conf.template
COPY frontend/start-nginx.sh /start-nginx.sh
RUN chmod +x /start-nginx.sh

EXPOSE 80
CMD ["/start-nginx.sh"]
```

### Environment Variables

```bash
# ── Required ──────────────────────────────────────
SECRET_KEY=                      # Django secret key
DATABASE_URL=                    # PostgreSQL connection string
GOOGLE_CLIENT_ID=                # OAuth client ID
GOOGLE_CLIENT_SECRET=            # OAuth client secret
ALLOWED_HOSTS=                   # Comma-separated hostnames
CSRF_TRUSTED_ORIGINS=            # Comma-separated with protocol
CORS_ALLOWED_ORIGINS=            # Comma-separated with protocol

# ── Optional ──────────────────────────────────────
REDIS_URL=redis://127.0.0.1:6379/1
SENTRY_DSN=                      # Error reporting
LOGIN_REDIRECT_URL=/app/dashboard
LOGOUT_REDIRECT_URL=/app
DJANGO_Q_WORKERS=8
DJANGO_Q_TIMEOUT=900

# ── Container Startup ─────────────────────────────
DJANGO_SUPERUSER_USERNAME=admin
DJANGO_SUPERUSER_EMAIL=admin@example.com
DJANGO_SUPERUSER_PASSWORD=

# ── Frontend ──────────────────────────────────────
BACKEND_URL=backend:8080         # Nginx → Django address
REACT_APP_API_URL=               # Empty = same-origin (production)
```

## Architectural Decisions & Rationale

### 1. Session Auth over JWT

Sessions are simpler and more secure for SPAs served from the same origin. No token refresh logic, no localStorage vulnerabilities. The trade-off (server-side session state) is negligible at expected scale.

### 2. SPA Under /app Prefix

Mounting the React app at `/app/*` cleanly separates it from Django-served pages (`/admin/`, `/accounts/*`). Nginx routing becomes trivial. The `PUBLIC_URL=/app` build config and `basename="/app"` router config make this work.

### 3. Synchronous-First Processing

Start with synchronous request handlers for immediate feedback. The Django-Q2 infrastructure is configured and ready — switching to async requires changing a single function call in the view. Don't add async complexity until you need throughput.

### 4. No External State Management

React Context + local state covers one global concern (auth) and page-local state. Adding Redux/Zustand adds complexity without benefit at typical SPA scale. Reconsider only if you have 3+ global concerns with complex cross-component interactions.

### 5. No Component Library

Full control over design, smaller bundle, no version-upgrade pain. Trade-off: more manual work building components. Mitigated by the reusable patterns in the UI Design Template.

### 6. Single Domain App + Core App

Two Django apps: `core` (user model, auth adapters) and one domain app (all business logic). Don't prematurely split into microservices or multiple Django apps. Split only when a second app has genuinely independent models and views.

### 7. ORM Broker in Dev, Redis in Prod

Django-Q2's ORM broker means zero external dependencies during development. Redis in production provides the performance needed for concurrent workers. Same code, different config.

### 8. Separate QCluster Container

The task worker runs as its own container with the same codebase. This allows independent scaling (more workers without more API servers) and clean process isolation.

## New Project Checklist

1. [ ] Create Django project with custom User model in `core` app
2. [ ] Configure `settings.py` and `production_settings.py`
3. [ ] Set up django-allauth with Google OAuth2
4. [ ] Create domain app with initial models
5. [ ] Set up DRF with SessionAuthentication + IsAuthenticated defaults
6. [ ] Create React app with `PUBLIC_URL=/app`
7. [ ] Configure Tailwind with the design system (see UI_DESIGN_TEMPLATE.md)
8. [ ] Implement AuthContext with CSRF token flow
9. [ ] Set up React Router with `basename="/app"` and ProtectedRoute
10. [ ] Create Dockerfiles (backend, qcluster, frontend)
11. [ ] Create nginx.conf.template and start scripts
12. [ ] Write `.env.example` with all required variables
13. [ ] Create `setup_google_oauth` and `setup_superuser` management commands
14. [ ] Configure Django-Q2 (ORM broker for dev, Redis for prod)
15. [ ] Set up CORS, CSRF, and session cookie settings
