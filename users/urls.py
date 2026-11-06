from django.urls import path

from .views import (
    ProfileView,
    RegisterView,
    EmailVerificationView,
    LoginMathChallengeView,
    PermissionResourceDetailView,
    PermissionResourceListCreateView,
    ResendEmailVerificationView,
    RoleDetailView,
    RoleListCreateView,
    RolePermissionUpdateView,
    RolePermissionsView,
    SidebarLabelsView,
    UserDetailView,
    UserListCreateView,
)

urlpatterns = [
    path("register/", RegisterView.as_view(), name="register"),
    path("verify-email/", EmailVerificationView.as_view(), name="verify-email"),
    path(
        "resend-email-verification/",
        ResendEmailVerificationView.as_view(),
        name="resend-email-verification",
    ),
    path("login-challenge/", LoginMathChallengeView.as_view(), name="login-challenge"),
    path("me/", ProfileView.as_view(), name="profile"),
    path("users/", UserListCreateView.as_view(), name="user-list"),
    path("users/<int:pk>/", UserDetailView.as_view(), name="user-detail"),
    path("roles/", RoleListCreateView.as_view(), name="role-list"),
    path("roles/<int:pk>/", RoleDetailView.as_view(), name="role-detail"),
    path("permissions/", RolePermissionsView.as_view(), name="role-permissions"),
    path(
        "resources/",
        PermissionResourceListCreateView.as_view(),
        name="permission-resource-list",
    ),
    path(
        "resources/<str:key>/",
        PermissionResourceDetailView.as_view(),
        name="permission-resource-detail",
    ),
    path("sidebar-labels/", SidebarLabelsView.as_view(), name="sidebar-labels"),
    path(
        "permissions/<str:role_name>/",
        RolePermissionUpdateView.as_view(),
        name="role-permissions-update",
    ),
]
