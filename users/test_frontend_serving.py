import re
import tempfile
from pathlib import Path

from django.http import Http404
from django.test import RequestFactory, SimpleTestCase, override_settings

from myproject.frontend import SPA_ROUTE_PATTERN, spa_index


class FrontendServingTests(SimpleTestCase):
    def test_portal_routes_match_and_api_or_django_admin_do_not(self):
        pattern = re.compile(SPA_ROUTE_PATTERN)
        for path in (
            "app",
            "app/",
            "app/dashboard",
            "app/resources/campanas",
            "admin/permissions",
            "admin/permissions/",
        ):
            self.assertIsNotNone(pattern.match(path), path)
        for path in (
            "",
            "api/v1/",
            "api/v1/pets/",
            "admin/",
            "admin/login/",
            "admin/users/user/",
            "application",
            "api-auth/login/",
        ):
            self.assertIsNone(pattern.match(path), path)

    def test_spa_index_returns_the_built_html_without_caching(self):
        with tempfile.TemporaryDirectory() as dist:
            Path(dist, "index.html").write_text(
                '<!doctype html><div id="root"></div>', encoding="utf-8"
            )
            with override_settings(FRONTEND_DIST_DIR=dist):
                response = spa_index(RequestFactory().get("/app/dashboard"))
                body = b"".join(response.streaming_content)
                response.close()
        self.assertEqual(response.status_code, 200)
        self.assertIn("text/html", response["Content-Type"])
        self.assertEqual(response["Cache-Control"], "no-cache")
        self.assertIn(b'id="root"', body)

    def test_spa_index_is_404_when_the_portal_is_not_built(self):
        with tempfile.TemporaryDirectory() as dist:
            with override_settings(FRONTEND_DIST_DIR=dist):
                with self.assertRaises(Http404):
                    spa_index(RequestFactory().get("/app/dashboard"))

    def test_spa_index_rejects_writes(self):
        response = spa_index(RequestFactory().post("/app/dashboard"))
        self.assertEqual(response.status_code, 405)
