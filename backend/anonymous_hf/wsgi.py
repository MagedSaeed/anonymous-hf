"""WSGI config for anonymous_hf project."""

import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "anonymous_hf.settings")

application = get_wsgi_application()
