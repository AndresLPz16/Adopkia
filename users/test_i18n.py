import secrets

from django.utils import translation
from django.utils.translation import gettext
from django.urls import reverse
from rest_framework.test import APITestCase

from users.models import User


class LanguagePreferenceTests(APITestCase):
    def test_root_returns_api_index_and_api_v1_remains_available(self):
        response = self.client.get("/", HTTP_ACCEPT="application/json")
        index = self.client.get("/api/v1/", HTTP_ACCEPT="application/json")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(index.status_code, 200)
        self.assertEqual(response.json(), index.json())
        self.assertIn("pets", {item["key"] for item in response.json()["resources"]})

    def test_duplicate_registration_error_is_translated(self):
        User.objects.create_user(
            email="duplicate@example.com",
            password=secrets.token_urlsafe(24),
            name="Existing adopter",
        )
        body = {
            "email": "duplicate@example.com",
            "password": "SafePass!2026",
            "name": "New adopter",
        }
        spanish = self.client.post(reverse("register") + "?lang=es", body, format="json")
        english = self.client.post(reverse("register") + "?lang=en", body, format="json")
        self.assertEqual(spanish.status_code, 400)
        self.assertEqual(english.status_code, 400)
        self.assertIn("Ya existe una cuenta registrada", str(spanish.data))
        self.assertIn("An account is already registered", str(english.data))

    def test_admin_paths_load_in_spanish_and_english(self):
        spanish = self.client.get("/admin/")
        english = self.client.get("/en/admin/")
        self.assertIn(spanish.status_code, (200, 302))
        self.assertIn(english.status_code, (200, 302))
        self.assertEqual(spanish.headers["Content-Language"], "es")
        self.assertEqual(english.headers["Content-Language"], "en")

    def test_missing_english_translation_falls_back_to_spanish_source(self):
        with translation.override("en"):
            self.assertEqual(gettext("Texto aún no traducido"), "Texto aún no traducido")
