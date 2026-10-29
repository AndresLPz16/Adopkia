from django.urls import path

from .views import (
    ProfileView,
    RegisterView,
    RoleDetailView,
    RoleListCreateView,
    RolePermissionUpdateView,
    RolePermissionsView,
    UserDetailView,
    UserListCreateView,
)

urlpatterns = [
    path("register/", RegisterView.as_view(), name="register"),
    path("me/", ProfileView.as_view(), name="profile"),
    path("users/", UserListCreateView.as_view(), name="user-list"),
    path("users/<int:pk>/", UserDetailView.as_view(), name="user-detail"),
    path("roles/", RoleListCreateView.as_view(), name="role-list"),
    path("roles/<int:pk>/", RoleDetailView.as_view(), name="role-detail"),
    path("permissions/", RolePermissionsView.as_view(), name="role-permissions"),
    path(
        "permissions/<str:role_name>/",
        RolePermissionUpdateView.as_view(),
        name="role-permissions-update",
    ),
]
