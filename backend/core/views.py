import secrets
from datetime import timedelta
from urllib.parse import urlencode

import requests as http_requests
from django.conf import settings
from django.contrib.auth import login, logout
from django.http import HttpResponse
from django.shortcuts import redirect
from django.utils import timezone
from django.views import View
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import User
from .serializers import UserSerializer


class CSRFTokenView(APIView):
    """Set CSRF cookie for the React SPA."""

    permission_classes = [AllowAny]

    def get(self, request):
        from django.middleware.csrf import get_token

        get_token(request)
        return Response({"detail": "CSRF cookie set"})


class ProfileView(APIView):
    """Get or update current user profile."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)

    def patch(self, request):
        serializer = UserSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class HealthCheckView(APIView):
    """Simple health check endpoint."""

    permission_classes = [AllowAny]

    def get(self, request):
        return Response({"status": "ok"})


class HuggingFaceLoginView(View):
    """Initiate HuggingFace OAuth2 authorization flow."""

    def get(self, request):
        state = secrets.token_urlsafe(32)
        request.session["oauth_state"] = state

        params = {
            "client_id": settings.HUGGINGFACE_CLIENT_ID,
            "redirect_uri": settings.HUGGINGFACE_REDIRECT_URI,
            "response_type": "code",
            "scope": "openid profile email read-repos",
            "state": state,
        }
        authorize_url = f"https://huggingface.co/oauth/authorize?{urlencode(params)}"
        return redirect(authorize_url)


class HuggingFaceCallbackView(View):
    """Handle HuggingFace OAuth2 callback."""

    def get(self, request):
        # Validate state parameter
        state = request.GET.get("state")
        expected_state = request.session.pop("oauth_state", None)
        if not state or state != expected_state:
            return HttpResponse("Invalid state parameter", status=400)

        # Check for errors
        error = request.GET.get("error")
        if error:
            error_description = request.GET.get("error_description", "Unknown error")
            return HttpResponse(f"OAuth error: {error_description}", status=400)

        code = request.GET.get("code")
        if not code:
            return HttpResponse("Missing authorization code", status=400)

        # Exchange code for tokens
        token_response = http_requests.post(
            "https://huggingface.co/oauth/token",
            data={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": settings.HUGGINGFACE_REDIRECT_URI,
                "client_id": settings.HUGGINGFACE_CLIENT_ID,
                "client_secret": settings.HUGGINGFACE_CLIENT_SECRET,
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=30,
        )
        if token_response.status_code != 200:
            return HttpResponse("Failed to exchange code for token", status=400)

        tokens = token_response.json()
        access_token = tokens["access_token"]
        refresh_token = tokens.get("refresh_token", "")
        expires_in = tokens.get("expires_in", 28800)

        # Fetch user info
        userinfo_response = http_requests.get(
            "https://huggingface.co/oauth/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=30,
        )
        if userinfo_response.status_code != 200:
            return HttpResponse("Failed to fetch user info", status=400)

        userinfo = userinfo_response.json()
        hf_id = userinfo.get("sub", "")
        hf_username = userinfo.get("preferred_username", "")
        email = userinfo.get("email", "")
        avatar_url = userinfo.get("picture", "")

        if not hf_id:
            return HttpResponse("Could not retrieve HuggingFace user ID", status=400)

        # Create or update user
        user, created = User.objects.update_or_create(
            hf_id=hf_id,
            defaults={
                "username": hf_username or f"hf_{hf_id[:8]}",
                "email": email,
                "hf_username": hf_username,
                "avatar_url": avatar_url,
                "hf_access_token": access_token,
                "hf_refresh_token": refresh_token,
                "hf_token_expires_at": timezone.now() + timedelta(seconds=expires_in),
            },
        )

        # Log in and redirect to dashboard
        login(request, user)
        return redirect(settings.LOGIN_REDIRECT_URL)


class LogoutView(View):
    """Log out the user and redirect to home."""

    def get(self, request):
        logout(request)
        return redirect(settings.LOGOUT_REDIRECT_URL)

    def post(self, request):
        logout(request)
        return redirect(settings.LOGOUT_REDIRECT_URL)


class DeleteAccountView(APIView):
    """Soft-delete user account and cascade to repos."""

    permission_classes = [IsAuthenticated]

    def delete(self, request):
        user = request.user
        # Soft-delete all anonymous repos
        user.anonymousrepo_set.update(status="deleted")
        # Deactivate user
        user.is_active = False
        user.save(update_fields=["is_active"])
        # Logout
        logout(request)
        return Response({"detail": "Account deleted"}, status=status.HTTP_200_OK)
