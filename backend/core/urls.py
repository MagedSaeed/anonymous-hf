from django.urls import path

from . import views

urlpatterns = [
    path("csrf-token/", views.CSRFTokenView.as_view(), name="csrf-token"),
    path("profile/", views.ProfileView.as_view(), name="profile"),
    path("health/", views.HealthCheckView.as_view(), name="health"),
    path("delete-account/", views.DeleteAccountView.as_view(), name="delete-account"),
]
