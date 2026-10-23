from django.urls import path

from .views import (
    ProfileView,
    RegisterView,
    RolePermissionUpdateView,
    RolePermissionsView,
)

urlpatterns = [
    path("register/", RegisterView.as_view(), name="register"),
    path("me/", ProfileView.as_view(), name="profile"),
    path("permissions/", RolePermissionsView.as_view(), name="role-permissions"),
    path(
        "permissions/<str:role_name>/",
        RolePermissionUpdateView.as_view(),
        name="role-permissions-update",
    ),
]
