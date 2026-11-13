from django.conf import settings
from django.http import HttpResponse
from django.utils.translation import gettext as _
from rest_framework.throttling import SimpleRateThrottle


class AuthRateThrottle(SimpleRateThrottle):
    """Límite por dirección IP para los endpoints públicos de autenticación.

    Las tasas se leen de ``settings.AUTH_THROTTLE_RATES`` en cada petición; un
    alcance sin tasa configurada no se limita.
    """

    def get_rate(self):
        return settings.AUTH_THROTTLE_RATES.get(self.scope)

    def get_cache_key(self, request, view):
        return self.cache_format % {
            "scope": self.scope,
            "ident": self.get_ident(request),
        }


class LoginRateThrottle(AuthRateThrottle):
    scope = "auth_login"


class LoginIdentifierRateThrottle(AuthRateThrottle):
    """Límite por cuenta: frena ataques repartidos entre muchas direcciones IP."""

    scope = "auth_login_identifier"

    def get_cache_key(self, request, view):
        data = getattr(request, "data", None) or getattr(request, "POST", {})
        identifier = data.get("identifier") or data.get("email") or data.get("username")
        if not isinstance(identifier, str) or not identifier.strip():
            return None
        return self.cache_format % {
            "scope": self.scope,
            "ident": identifier.strip().lower()[:150],
        }


class LoginChallengeRateThrottle(AuthRateThrottle):
    scope = "auth_login_challenge"


class RegisterRateThrottle(AuthRateThrottle):
    scope = "auth_register"


class EmailVerificationRateThrottle(AuthRateThrottle):
    scope = "auth_verify_email"


class ResendEmailVerificationRateThrottle(AuthRateThrottle):
    scope = "auth_resend_verification"


class SessionLoginRateLimitMiddleware:
    """Aplica los límites de login a los formularios de sesión de Django.

    Cubre ``/api-auth/login/`` y el login del panel ``/admin/``, que no pasan
    por las vistas de DRF y por tanto no usan ``throttle_classes``.
    """

    throttle_classes = (LoginRateThrottle, LoginIdentifierRateThrottle)

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        return self.get_response(request)

    def process_view(self, request, view_func, view_args, view_kwargs):
        match = request.resolver_match
        if request.method != "POST" or match is None or match.url_name != "login":
            return None
        waits = []
        for throttle_class in self.throttle_classes:
            throttle = throttle_class()
            if not throttle.allow_request(request, None):
                waits.append(throttle.wait())
        if not waits:
            return None
        response = HttpResponse(
            _("Demasiados intentos de inicio de sesión. Inténtalo más tarde."),
            status=429,
            content_type="text/plain; charset=utf-8",
        )
        retry_after = max((wait for wait in waits if wait), default=None)
        if retry_after:
            response["Retry-After"] = str(int(retry_after) + 1)
        return response
