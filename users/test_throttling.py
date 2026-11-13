from django.core.cache import cache
from django.test import TestCase, override_settings
from django.urls import reverse
from rest_framework.test import APIClient

from users.models import LoginMathChallenge, Role, User
from users.security import create_login_math_challenge


class AuthThrottlingTests(TestCase):
    password = "ThrottleTest!2026"

    def setUp(self):
        cache.clear()
        self.addCleanup(cache.clear)
        self.client = APIClient()
        role, _ = Role.objects.get_or_create(name=Role.Name.ADMIN)
        self.user = User.objects.create_user(
            email="throttle@example.com",
            password=self.password,
            name="Throttle",
            role=role,
        )

    def login(self, identifier, password="wrong-password", **extra):
        challenge, question = create_login_math_challenge()
        left, right = (int(part) for part in question.rstrip(" =?").split(" + "))
        return self.client.post(
            reverse("token_obtain_pair"),
            {
                "identifier": identifier,
                "password": password,
                "challenge_id": str(challenge.pk),
                "challenge_answer": str(left + right),
            },
            format="json",
            **extra,
        )

    def test_rates_are_disabled_in_the_test_suites(self):
        for _attempt in range(30):
            response = self.client.get(reverse("login-challenge"))
            self.assertEqual(response.status_code, 200)

    @override_settings(AUTH_THROTTLE_RATES={"auth_login_challenge": "3/min"})
    def test_login_challenge_is_limited_per_ip(self):
        for _attempt in range(3):
            self.assertEqual(self.client.get(reverse("login-challenge")).status_code, 200)
        blocked = self.client.get(reverse("login-challenge"))
        self.assertEqual(blocked.status_code, 429)
        self.assertIn("Retry-After", blocked.headers)
        self.assertEqual(LoginMathChallenge.objects.count(), 3)
        other_ip = self.client.get(reverse("login-challenge"), REMOTE_ADDR="10.0.0.9")
        self.assertEqual(other_ip.status_code, 200)

    @override_settings(AUTH_THROTTLE_RATES={"auth_login": "2/min"})
    def test_login_is_limited_per_ip(self):
        self.assertEqual(self.login("a@example.com").status_code, 401)
        self.assertEqual(self.login("b@example.com").status_code, 401)
        self.assertEqual(self.login("c@example.com").status_code, 429)

    @override_settings(AUTH_THROTTLE_RATES={"auth_login_identifier": "2/min"})
    def test_login_is_limited_per_account_across_ips(self):
        self.assertEqual(
            self.login("throttle@example.com", REMOTE_ADDR="10.0.0.1").status_code, 401
        )
        self.assertEqual(
            self.login("THROTTLE@example.com", REMOTE_ADDR="10.0.0.2").status_code, 401
        )
        blocked = self.login(
            "throttle@example.com", password=self.password, REMOTE_ADDR="10.0.0.3"
        )
        self.assertEqual(blocked.status_code, 429)
        other_account = self.login("other@example.com", REMOTE_ADDR="10.0.0.3")
        self.assertEqual(other_account.status_code, 401)

    @override_settings(
        AUTH_THROTTLE_RATES={
            "auth_register": "1/hour",
            "auth_verify_email": "1/min",
            "auth_resend_verification": "1/hour",
        }
    )
    def test_register_verify_and_resend_are_limited(self):
        for name, payload in (
            ("register", {}),
            ("verify-email", {"email": "nobody@example.com", "code": "000000"}),
            ("resend-email-verification", {"email": "nobody@example.com"}),
        ):
            with self.subTest(endpoint=name):
                first = self.client.post(reverse(name), payload, format="json")
                self.assertNotEqual(first.status_code, 429)
                second = self.client.post(reverse(name), payload, format="json")
                self.assertEqual(second.status_code, 429)

    @override_settings(AUTH_THROTTLE_RATES={"auth_login": "2/min"})
    def test_session_login_forms_are_limited(self):
        for url in ("/api-auth/login/", "/admin/login/"):
            with self.subTest(url=url):
                cache.clear()
                payload = {"username": "throttle@example.com", "password": "wrong"}
                self.assertEqual(self.client.post(url, payload).status_code, 200)
                self.assertEqual(self.client.post(url, payload).status_code, 200)
                blocked = self.client.post(url, payload)
                self.assertEqual(blocked.status_code, 429)
                self.assertIn("Retry-After", blocked.headers)
                self.assertEqual(self.client.get(url).status_code, 200)
