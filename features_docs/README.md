# Anonymous HuggingFace - Feature Specifications

Complete technical specifications for building an Anonymous HuggingFace platform - a service that provides anonymous access to HuggingFace repositories for double-blind peer review.

---

## 📋 Documentation Overview

### **PROJECT_OVERVIEW.md**
Project setup, environment configuration, development workflow, and troubleshooting.

### **IMPLEMENTATION_ROADMAP.md**
5-phase implementation plan with dependencies and milestones.

---

## 🔨 Feature Specifications

### Foundation

**FEATURE_00_TESTING_INFRASTRUCTURE.md**
- Testing frameworks: pytest, Vitest
- Code quality: Ruff, ESLint, Prettier
- Pre-commit hooks
- Docker setup
- UV package management

**FEATURE_01_PROJECT_SETUP.md**
- Django 5.2 + React 18
- HuggingFace OAuth integration
- Custom User model
- Basic authentication
- Docker Compose configuration

### Core Functionality

**FEATURE_02_DATA_MODELS_AND_PROXY.md**
- Database models: AnonymousRepo, ActivityLog
- HuggingFace API client
- Proxy architecture
- Django admin customization

**FEATURE_03_PROXY_SERVICE.md**
- HTTP proxy implementation
- File streaming
- Directory listings
- Rate limiting

**FEATURE_04_API_ENDPOINTS.md**
- REST API for anonymous repos
- CRUD operations
- Serializers and permissions
- Activity logs API

### User Interface

**FEATURE_05_REACT_UI.md**
- Dashboard (repo list)
- Create repo form
- Repo details page
- User guidelines

**FEATURE_06_PUBLIC_VIEWER.md**
- Public file browser
- README rendering
- File downloads
- Directory navigation

**FEATURE_07_USER_SETTINGS.md**
- User profile
- Preferences
- Statistics
- Account deletion

### Production

**FEATURE_08_DEPLOYMENT_CICD.md**
- GitHub Actions CI/CD
- Production configuration
- SSL/TLS setup
- Monitoring and backups

### Enhancements

**FEATURE_09_ADMIN_DASHBOARD.md**
- Enhanced Django admin
- Platform statistics
- Moderation tools
- Abuse detection

---

## 🎯 Minimum Viable Product (MVP)

**Features 0-7** constitute a fully functional MVP:
- User authentication
- Anonymous repo creation
- HuggingFace proxy
- Public file viewer
- Complete UI

---

## 🏗️ Architecture Overview

### Platform Purpose
Provide anonymous access to HuggingFace repositories for double-blind academic review.

### How It Works
1. User creates anonymized version of their repo in a HuggingFace branch
2. User submits branch URL to platform
3. Platform generates anonymous URL
4. Platform proxies requests to HuggingFace branch
5. Reviewers access content via anonymous URL

### Key Principles
- **Proxy-based**: Platform doesn't store files, just proxies to HuggingFace
- **User responsibility**: User anonymizes content in their HF branch
- **Simple architecture**: URL mapping + HTTP proxy
- **Stateless**: Easy to scale horizontally

---

## 🛠️ Tech Stack

**Backend**
- Django 5.2
- Django REST Framework
- PostgreSQL
- Redis (optional, for sessions)
- UV (package management)

**Frontend**
- React 18
- Tailwind CSS
- Axios
- React Router

**DevOps**
- Docker + Docker Compose
- Nginx (reverse proxy)
- Gunicorn (WSGI server)
- GitHub Actions (CI/CD)

**Testing**
- pytest + pytest-django (backend)
- Vitest + React Testing Library (frontend)
- Ruff (linting/formatting)
- pre-commit hooks

---

## 📊 Feature Summary

| # | Feature | Dependencies | Priority |
|---|---------|--------------|----------|
| 0 | Testing Infrastructure | None | Critical |
| 1 | Project Setup | Feature 0 | Critical |
| 2 | Data Models & Proxy | Feature 1 | Critical |
| 3 | Proxy Service | Feature 2 | Critical |
| 4 | API Endpoints | Features 2,3 | High |
| 5 | React UI | Feature 4 | High |
| 6 | Public Viewer | Feature 3 | High |
| 7 | User Settings | Feature 4 | Medium |
| 8 | Deployment & CI/CD | All | High |
| 9 | Admin Dashboard | Feature 8 | Low |

---

## 🚀 Getting Started

1. Read **PROJECT_OVERVIEW.md** for setup instructions
2. Review **IMPLEMENTATION_ROADMAP.md** for implementation order
3. Implement features sequentially (0 → 1 → 2 → ...)
4. Each feature includes:
   - Requirements
   - Acceptance criteria
   - Testing requirements
   - Implementation notes

---

## 📝 Feature File Format

Each feature specification includes:

- **Goal**: What this feature accomplishes
- **Dependencies**: Which features must be complete first
- **Requirements**: Technical specifications
- **Testing**: Required tests and coverage targets
- **Acceptance Criteria**: Checklist for completion
- **Implementation Notes**: Important considerations

---

## ✅ Quality Standards

- **Test coverage**: 80%+ backend, 70%+ frontend
- **Code quality**: All code passes Ruff, ESLint, Prettier
- **Pre-commit**: All tests run before commit
- **Documentation**: Each feature documented inline
- **Docker**: All services containerized

---

## 📞 Implementation Support

All technical details are in the feature files. Each specification is self-contained and ready for implementation.

Start with Feature 0 and proceed sequentially through the features.
