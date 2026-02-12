from rest_framework.permissions import BasePermission


class IsOwner(BasePermission):
    """Only allow the owner of an object to access it."""

    def has_object_permission(self, request, view, obj):
        return obj.owner == request.user
