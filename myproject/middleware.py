import re
from types import SimpleNamespace

from django.conf import settings
from django.utils import translation

from myproject.frontend import SPA_ROUTE_PATTERN


class QueryLanguageMiddleware:
    supported_languages = frozenset({"es", "en"})
    default_language = "es"

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        language = request.GET.get("lang", "").lower()
        if language not in self.supported_languages:
            language = translation.get_language_from_path(request.path_info)
        if language not in self.supported_languages:
            language = translation.get_language_from_request(
                SimpleNamespace(COOKIES={}, META=request.META),
                check_path=False,
            )
        if language not in self.supported_languages:
            language = self.default_language

        translation.activate(language)
        request.LANGUAGE_CODE = language

        response = self.get_response(request)
        response.headers["Content-Language"] = language
        return response


# Política para el portal: solo ejecuta scripts propios, se conecta solo a la
# propia API y no se puede incrustar en otra página. Los estilos en línea se
# permiten porque las animaciones de React los usan; las fotos pueden venir de
# un enlace externo o de Azure Blob Storage.
PORTAL_CONTENT_SECURITY_POLICY = "; ".join(
    (
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob: https:",
        "font-src 'self' data:",
        "connect-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
    )
)
# El panel de Django, la API navegable y la documentación traen sus propios
# scripts; se quedan con las protecciones generales de Django.
# Las rutas del portal bajo /admin/ (como /admin/permissions) sí la llevan.
CSP_EXEMPT_PREFIXES = ("/admin/", "/api/", "/api-auth/")
SPA_ROUTE = re.compile(SPA_ROUTE_PATTERN)


class SecurityHeadersMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        response.headers.setdefault(
            "Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()"
        )
        # Solo cuando Django entrega el portal compilado; sin él, la raíz es la
        # API navegable.
        serves_portal = bool(settings.FRONTEND_DIST_DIR)
        is_html = response.headers.get("Content-Type", "").startswith("text/html")
        is_portal_page = not request.path.startswith(CSP_EXEMPT_PREFIXES) or bool(
            SPA_ROUTE.match(request.path.lstrip("/"))
        )
        if serves_portal and is_html and is_portal_page:
            response.headers.setdefault(
                "Content-Security-Policy", PORTAL_CONTENT_SECURITY_POLICY
            )
        return response
