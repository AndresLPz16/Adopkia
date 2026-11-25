from django.core.cache import cache
from django.http import HttpResponse
from django.test import RequestFactory, SimpleTestCase, TestCase, override_settings
from django.urls import reverse
from rest_framework.test import APIClient

from myproject.authentication import REFRESH_COOKIE_NAME, REFRESH_COOKIE_PATH
from myproject.middleware import SecurityHeadersMiddleware
from users.models import Role, User
from users.security import create_login_math_challenge


class RefreshCookieTests(TestCase):
    password = "SessionTest!2026"

    def setUp(self):
        self.client = APIClient()
        role, _ = Role.objects.get_or_create(name=Role.Name.ADOPTER)
        self.user = User.objects.create_user(
            email="session@example.com",
            password=self.password,
            name="Session",
            role=role,
            email_verified=True,
        )

    def login(self):
        challenge, question = create_login_math_challenge()
        left, right = (int(part) for part in question.rstrip(" =?").split(" + "))
        return self.client.post(
            reverse("token_obtain_pair"),
            {
                "identifier": self.user.email,
                "password": self.password,
                "challenge_id": str(challenge.pk),
                "challenge_answer": str(left + right),
            },
            format="json",
        )

    def test_login_keeps_the_refresh_token_out_of_reach_of_javascript(self):
        response = self.login()

        self.assertEqual(response.status_code, 200)
        self.assertIn("access", response.data)
        self.assertNotIn("refresh", response.data)
        cookie = response.cookies[REFRESH_COOKIE_NAME]
        self.assertTrue(cookie["httponly"])
        self.assertEqual(cookie["samesite"], "Strict")
        self.assertEqual(cookie["path"], REFRESH_COOKIE_PATH)

    def test_refresh_uses_the_cookie(self):
        self.login()

        response = self.client.post(reverse("token_refresh"), format="json")

        self.assertEqual(response.status_code, 200)
        self.assertIn("access", response.data)
        profile = self.client.get(
            reverse("profile"), HTTP_AUTHORIZATION=f"Bearer {response.data['access']}"
        )
        self.assertEqual(profile.status_code, 200)

    def test_refresh_without_a_session_is_rejected(self):
        response = self.client.post(reverse("token_refresh"), format="json")

        self.assertEqual(response.status_code, 401)

    def test_logout_revokes_the_refresh_token(self):
        self.login()
        stolen = self.client.cookies[REFRESH_COOKIE_NAME].value

        logout = self.client.post(reverse("token_logout"))

        self.assertEqual(logout.status_code, 204)
        self.assertEqual(logout.cookies[REFRESH_COOKIE_NAME].value, "")
        # Aunque alguien hubiera copiado el token, ya no sirve.
        reused = APIClient().post(reverse("token_refresh"), {"refresh": stolen}, format="json")
        self.assertEqual(reused.status_code, 401)

    def test_logout_without_a_session_still_succeeds(self):
        self.assertEqual(self.client.post(reverse("token_logout")).status_code, 204)


class ApiRateLimitTests(TestCase):
    def setUp(self):
        cache.clear()
        self.addCleanup(cache.clear)

    def test_the_general_limit_is_disabled_in_the_test_suites(self):
        client = APIClient()
        for _attempt in range(30):
            self.assertEqual(client.get("/api/v1/shelters/").status_code, 200)

    @override_settings(API_THROTTLE_RATES={"api_anon": "3/min", "api_user": "3/min"})
    def test_anonymous_requests_are_limited_per_ip(self):
        client = APIClient()
        for _attempt in range(3):
            self.assertEqual(client.get("/api/v1/shelters/").status_code, 200)

        blocked = client.get("/api/v1/shelters/")

        self.assertEqual(blocked.status_code, 429)
        self.assertIn("Retry-After", blocked)


class SecurityHeadersTests(SimpleTestCase):
    def response_for(self, path, content_type="text/html; charset=utf-8"):
        middleware = SecurityHeadersMiddleware(
            lambda request: HttpResponse("<!doctype html>", content_type=content_type)
        )
        with override_settings(FRONTEND_DIST_DIR="dist"):
            return middleware(RequestFactory().get(path))

    def test_portal_pages_carry_a_content_security_policy(self):
        for path in ("/", "/app/dashboard", "/admin/permissions"):
            with self.subTest(path=path):
                policy = self.response_for(path)["Content-Security-Policy"]
                self.assertIn("script-src 'self'", policy)
                self.assertIn("frame-ancestors 'none'", policy)

    def test_api_and_django_admin_keep_their_own_scripts(self):
        for path in ("/admin/login/", "/api/docs/", "/api-auth/login/"):
            with self.subTest(path=path):
                response = self.response_for(path)
                self.assertNotIn("Content-Security-Policy", response)
                self.assertIn("Permissions-Policy", response)

    def test_without_a_built_portal_no_policy_is_added(self):
        middleware = SecurityHeadersMiddleware(
            lambda request: HttpResponse("<!doctype html>", content_type="text/html")
        )
        with override_settings(FRONTEND_DIST_DIR=""):
            response = middleware(RequestFactory().get("/"))
        self.assertNotIn("Content-Security-Policy", response)
