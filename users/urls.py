from django.urls import path

from .views import (
    ProfileView,
    RegisterView,
    EmailVerificationView,
    LoginMathChallengeView,
    ResendEmailVerificationView,
    RoleDetailView,
    RoleListCreateView,
    RolePermissionUpdateView,
    RolePermissionsView,
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
        "permissions/<str:role_name>/",
        RolePermissionUpdateView.as_view(),
        name="role-permissions-update",
    ),
]
