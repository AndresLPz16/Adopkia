from django.test import TestCase
from django.urls import reverse
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.test import APIClient

from myproject.api_index import (
    PUBLIC_RESOURCES,
    RESOURCE_DEFINITIONS,
    ROLE_RESOURCES,
)
from users.models import Role, User


class ApiIndexPermissionAlignmentTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.roles = {}
        for role_name in ROLE_RESOURCES:
            role, _ = Role.objects.get_or_create(name=role_name)
            user = User.objects.create_user(
                email=f"{role_name}@example.com",
                password="SafePass!2026",
                name=f"Test {role_name}",
                role=role,
            )
            self.roles[role_name] = (user, str(RefreshToken.for_user(user).access_token))

    def test_anonymous_index_only_lists_public_resources(self):
        response = self.client.get(reverse("api-root"))
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.json()["role"])
        expected_resources = {
            "register", "login", "refresh", "verified_shelters", "species",
            "breeds", "pets", "form_questions", "vaccines", "api_docs",
            "openapi_schema",
        }
        self.assertEqual(
            {resource["key"] for resource in response.json()["resources"]},
            expected_resources,
        )
        self.assertEqual(response.json()["login_url"], "/api-auth/login/")
        self.assertIn("recursos públicos", response.json()["message"])
        self.assertIn("Log in", response.json()["message"])
        self.assertTrue(
            all(
                resource["url"].startswith("http://testserver/")
                for resource in response.json()["resources"]
            )
        )
        self.assert_resources_match_statuses(response.json()["resources"], None)

    def test_root_is_the_same_direct_api_index_as_api_v1(self):
        root = self.client.get("/", HTTP_ACCEPT="application/json")
        api_root = self.client.get("/api/v1/", HTTP_ACCEPT="application/json")

        self.assertEqual(root.status_code, 200)
        self.assertNotIn("Location", root.headers)
        self.assertEqual(root.json(), api_root.json())

    def test_anonymous_index_message_is_translated_without_changing_resources(self):
        spanish = self.client.get(reverse("api-root") + "?lang=es")
        english = self.client.get(reverse("api-root") + "?lang=en")
        english_header = self.client.get(
            reverse("api-root"), HTTP_ACCEPT_LANGUAGE="en"
        )
        expected_resources = set(PUBLIC_RESOURCES)
        self.assertEqual(
            {resource["key"] for resource in spanish.json()["resources"]},
            expected_resources,
        )
        self.assertEqual(
            {resource["key"] for resource in english.json()["resources"]},
            expected_resources,
        )
        self.assertEqual(spanish.json()["login_url"], "/api-auth/login/")
        self.assertEqual(english.json()["login_url"], "/api-auth/login/")
        self.assertIn("recursos públicos", spanish.json()["message"])
        self.assertIn("Log in", spanish.json()["message"])
        self.assertIn("public resources", english.json()["message"])
        self.assertIn("Log in", english.json()["message"])
        self.assertIn("upper-right corner", english.json()["message"])
        self.assertIn("public resources", english_header.json()["message"])

    def test_login_errors_are_localized_and_inactive_accounts_are_rejected(self):
        adopter, _ = self.roles[Role.Name.ADOPTER]
        adopter.active = False
        adopter.save(update_fields=["active"])
        credentials = {"email": adopter.email, "password": "SafePass!2026"}

        spanish = self.client.post(
            "/api/v1/auth/login/?lang=es", credentials, format="json"
        )
        english = self.client.post(
            "/api/v1/auth/login/?lang=en", credentials, format="json"
        )

        self.assertEqual(spanish.status_code, 401)
        self.assertEqual(english.status_code, 401)
        self.assertIn("cuenta inactiva", spanish.json()["detail"].lower())
        self.assertIn("inactive account", english.json()["detail"].lower())

    def test_each_authenticated_role_lists_exactly_its_accessible_resources(self):
        for role_name, (_, token) in self.roles.items():
            with self.subTest(role=role_name):
                self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
                response = self.client.get(reverse("api-root") + "?lang=en")
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.json()["role_code"], role_name)
                self.assertIn(
                    response.json()["role"],
                    {"Adopter", "Shelter", "Administrator", "Veterinarian"},
                )
                localized_names = {
                    resource["key"]: resource["name"]
                    for resource in response.json()["resources"]
                }
                self.assertEqual(
                    localized_names["verified_shelters"], "Verified shelters"
                )
                self.assertEqual(localized_names["pets"], "Pets")
                self.assertEqual(
                    localized_names["adoption_requests"], "Adoption requests"
                )
                self.assert_resources_match_statuses(
                    response.json()["resources"],
                    token,
                    allowed=ROLE_RESOURCES[role_name],
                )

    def assert_resources_match_statuses(self, listed_resources, token, allowed=None):
        listed_keys = {resource["key"] for resource in listed_resources}
        self.assertEqual(listed_keys, set(allowed or PUBLIC_RESOURCES))
        if token:
            self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        else:
            self.client.credentials()

        for key, (_, url) in RESOURCE_DEFINITIONS.items():
            with self.subTest(resource=key, token=bool(token)):
                accept = "text/html" if key == "api_docs" else "application/json"
                response = self.client.get(url, HTTP_ACCEPT=accept)
                if key in listed_keys:
                    self.assertTrue(
                        200 <= response.status_code < 300 or response.status_code == 405,
                        f"Listed resource {key} returned {response.status_code}",
                    )
                else:
                    self.assertIn(
                        response.status_code,
                        (401, 403),
                        f"Unlisted resource {key} returned {response.status_code}",
                    )
