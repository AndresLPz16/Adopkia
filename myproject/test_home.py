from django.test import TestCase


class LandingPageTests(TestCase):
    def test_home_is_html_with_bilingual_session_and_in_page_navigation(self):
        spanish = self.client.get("/")
        english = self.client.get("/?lang=en")

        self.assertEqual(spanish.status_code, 200)
        self.assertEqual(english.status_code, 200)
        self.assertIn("text/html", spanish.headers["Content-Type"])
        self.assertIn('lang="es"', spanish.content.decode())
        self.assertIn('lang="en"', english.content.decode())
        self.assertIn("Correo electrónico", spanish.content.decode())
        self.assertIn("Email", english.content.decode())
        self.assertIn("api/v1/auth/login/", english.content.decode())
        self.assertIn("Bearer", english.content.decode())
        self.assertIn("textContent", english.content.decode())
        self.assertNotIn("innerHTML", english.content.decode())
        self.assertNotIn("localStorage", english.content.decode())
        self.assertIn("sessionStorage", english.content.decode())
        self.assertIn("pushState", english.content.decode())
        self.assertIn("popstate", english.content.decode())
        self.assertIn("refreshSession", english.content.decode())
        self.assertIn("credentials: \"omit\"", english.content.decode())
        self.assertIn('target="_blank" rel="noopener"', english.content.decode())
        self.assertIn("payload.next", english.content.decode())
        self.assertIn("payload.previous", english.content.decode())
        self.assertIn('navigateTo("#/home")', english.content.decode())

    def test_browsable_api_has_return_link_to_home(self):
        response = self.client.get("/api/v1/species/", HTTP_ACCEPT="text/html")
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "← Volver a Adopkia")
        self.assertContains(response, 'href="/"')
