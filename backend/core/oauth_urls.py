from django.urls import path

from . import views

urlpatterns = [
    path("login/", views.HuggingFaceLoginView.as_view(), name="hf-login"),
    path("callback/", views.HuggingFaceCallbackView.as_view(), name="hf-callback"),
    path("logout/", views.LogoutView.as_view(), name="hf-logout"),
]
