# Feature 8: Deployment & CI/CD

**Dependencies**: All previous features

**Goal**: Production deployment configuration and continuous integration pipeline.

---

## CI/CD Pipeline

### GitHub Actions Workflow

**.github/workflows/ci.yml**:

**On**: push, pull_request

**Jobs**:

1. **Lint & Format**
   - Run ruff check
   - Run ruff format --check
   - Run eslint
   - Run prettier --check
   - Run hadolint (Dockerfile)

2. **Test Backend**
   - Install dependencies with UV
   - Run pytest with coverage
   - Upload coverage to Codecov

3. **Test Frontend**
   - Install npm dependencies
   - Run vitest with coverage
   - Upload coverage to Codecov

4. **Build Docker Images**
   - Build backend image
   - Build frontend image
   - Push to registry (on main branch)

5. **Deploy** (on main branch only)
   - Deploy to production
   - Run migrations
   - Restart services

---

## Production Configuration

### Environment Variables

**Required**:
- SECRET_KEY (Django secret)
- DATABASE_URL (PostgreSQL connection)
- REDIS_URL (sessions/cache)
- HUGGINGFACE_CLIENT_ID
- HUGGINGFACE_CLIENT_SECRET
- ALLOWED_HOSTS
- SITE_URL

**Optional**:
- SENTRY_DSN (error tracking)
- EMAIL_HOST, EMAIL_PORT (notifications)

### Django Production Settings

**production_settings.py**:
- DEBUG = False
- ALLOWED_HOSTS from env
- PostgreSQL database
- Redis cache
- Static files via WhiteNoise
- HTTPS only
- Secure cookies
- HSTS enabled

### Docker Production

**docker-compose.prod.yml**:
- Gunicorn (4 workers)
- Nginx (reverse proxy, SSL)
- PostgreSQL (persistent volume)
- Redis (persistent volume)

**Healthchecks**:
- Django: /health endpoint
- PostgreSQL: pg_isready
- Redis: redis-cli ping

---

## SSL/TLS

**Let's Encrypt** via Certbot:
- Auto-renew certificates
- Nginx SSL configuration
- Redirect HTTP to HTTPS

**Nginx config**:
```nginx
server {
    listen 443 ssl http2;
    ssl_certificate /etc/letsencrypt/live/domain/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/domain/privkey.pem;
    
    # Proxy to Django
    location /api {
        proxy_pass http://backend:8000;
    }
    
    # Serve React
    location / {
        root /usr/share/nginx/html;
        try_files $uri /index.html;
    }
}
```

---

## Database Migrations

**In CI/CD**:
```bash
# Run migrations before deploy
docker-compose exec backend python manage.py migrate --no-input

# Check migrations
docker-compose exec backend python manage.py showmigrations
```

**Rollback plan**:
- Keep previous image tagged
- Database backup before migration
- Rollback command ready

---

## Monitoring

### Application Monitoring

**Sentry** (error tracking):
- Install: `pip install sentry-sdk`
- Initialize in settings.py
- Capture exceptions, performance

**Logs**:
- Structured JSON logs
- Log levels: INFO, WARNING, ERROR
- Rotate logs daily

### Infrastructure Monitoring

**Docker health checks**:
- Backend: Django health endpoint
- Frontend: Nginx ping
- Database: Connection check
- Redis: Ping

**Metrics to track**:
- Request rate
- Error rate
- Response time
- Database connections
- Memory usage

---

## Backup Strategy

### Database Backups

**Automated**:
- Daily full backup
- Retain 30 days
- Store in S3 or equivalent

**Script**:
```bash
#!/bin/bash
# Backup PostgreSQL
pg_dump -h localhost -U user dbname | gzip > backup-$(date +%Y%m%d).sql.gz

# Upload to S3
aws s3 cp backup-*.sql.gz s3://bucket/backups/
```

### Restore Process

```bash
# Download from S3
aws s3 cp s3://bucket/backups/backup-20240101.sql.gz .

# Restore
gunzip < backup-20240101.sql.gz | psql -h localhost -U user dbname
```

---

## Deployment Process

### Initial Deployment

1. Set up server (VPS, AWS EC2, etc.)
2. Install Docker & Docker Compose
3. Clone repository
4. Configure environment variables
5. Run: `docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d`
6. Run migrations
7. Create superuser
8. Set up SSL with Certbot
9. Configure domain DNS

### Updates

```bash
# Pull latest code
git pull origin main

# Rebuild images
docker-compose build

# Run migrations
docker-compose exec backend python manage.py migrate

# Restart services
docker-compose up -d

# Verify health
curl https://domain.com/health
```

---

## Rollback Procedure

```bash
# Revert to previous image
docker-compose down
git checkout previous-commit
docker-compose up -d

# Restore database if needed
gunzip < backup.sql.gz | psql -h localhost -U user dbname
```

---

## Security Hardening

**Server**:
- Firewall: Only ports 80, 443, 22
- SSH: Key-based auth only
- Auto-updates enabled

**Application**:
- HTTPS only
- Secure headers (HSTS, CSP)
- Rate limiting on API
- SQL injection protection (Django ORM)
- XSS protection (React escaping)

**Secrets**:
- Environment variables (not in code)
- Rotate secrets regularly
- Use secrets manager (AWS Secrets Manager, etc.)

---

## Testing

**Deployment tests**:
- Build Docker images successfully
- Health checks pass
- Migrations run without errors
- Static files served correctly

**Load tests** (optional):
- Test with Locust or similar
- Simulate 100 concurrent users
- Measure response times

**Coverage**: Infrastructure tested via CI/CD

---

## Acceptance Criteria

- [ ] CI pipeline runs on every push
- [ ] All tests pass in CI
- [ ] Docker images build successfully
- [ ] Production deployment works
- [ ] SSL certificate configured
- [ ] Database backups run daily
- [ ] Monitoring captures errors
- [ ] Rollback process documented
- [ ] Security hardening applied

---

## Implementation Notes

**Start simple**: Deploy to single VPS initially.

**Scale later**: Add load balancer, multiple workers when needed.

**Monitor first**: Set up monitoring before going live.

**Test deploys**: Use staging environment first.
