from django.test import TestCase
from django.urls import reverse

from pets.models import Species


class CatalogLanguageTests(TestCase):
    def setUp(self):
        Species.objects.get_or_create(name="Perro")

    def test_query_language_overrides_accept_language_for_catalog(self):
        response = self.client.get(
            reverse("species-list") + "?lang=en",
            HTTP_ACCEPT_LANGUAGE="es",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers["Content-Language"], "en")
        self.assertIn("Dog", {item["name"] for item in response.json()["results"]})

    def test_accept_language_and_default_localize_catalog(self):
        english = self.client.get(
            reverse("species-list"),
            HTTP_ACCEPT_LANGUAGE="en",
        )
        spanish = self.client.get(reverse("species-list"))
        self.assertEqual(english.headers["Content-Language"], "en")
        self.assertIn("Dog", {item["name"] for item in english.json()["results"]})
        self.assertEqual(spanish.headers["Content-Language"], "es")
        self.assertIn("Perro", {item["name"] for item in spanish.json()["results"]})
