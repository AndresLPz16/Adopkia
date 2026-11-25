from django.conf import settings
from django.db.models import Q
from django.utils.translation import gettext_lazy as _
from drf_spectacular.utils import OpenApiTypes, extend_schema
from rest_framework import permissions, status
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.settings import api_settings as jwt_settings
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from myproject.throttling import LoginIdentifierRateThrottle, LoginRateThrottle
from users.models import User
from users.security import consume_login_math_challenge


class LocalizedTokenObtainPairSerializer(TokenObtainPairSerializer):
    default_error_messages = {
        "no_active_account": _("Credenciales inválidas o cuenta inactiva.")
    }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["email"].required = False
        self.fields["identifier"] = self.fields["email"].__class__(
            required=False,
            write_only=True,
        )
        self.fields["challenge_id"] = self.fields["email"].__class__(
            required=True,
            write_only=True,
        )
        self.fields["challenge_answer"] = self.fields["email"].__class__(
            required=True,
            write_only=True,
        )

    def validate(self, attrs):
        identifier = attrs.get("identifier") or attrs.get("email", "")
        if not identifier or not consume_login_math_challenge(
            attrs["challenge_id"],
            attrs["challenge_answer"].strip(),
        ):
            raise AuthenticationFailed(_("Resuelve correctamente el reto matemático."))

        user = User.objects.filter(
            Q(email__iexact=identifier) | Q(username__iexact=identifier)
        ).first()
        attrs["email"] = user.email if user else identifier
        data = super().validate(attrs)
        if user is not None and not user.email_verified:
            raise AuthenticationFailed(
                _("Verifica tu correo antes de iniciar sesión.")
            )
        return data


# El token de renovación viaja en una cookie que JavaScript no puede leer
# (HttpOnly), así un script inyectado en la página no puede robarlo. Solo se
# envía a las rutas de autenticación y nunca desde otro sitio (SameSite=Strict).
REFRESH_COOKIE_NAME = "adopkia_refresh"
REFRESH_COOKIE_PATH = "/api/v1/auth/"


def set_refresh_cookie(response, refresh):
    response.set_cookie(
        REFRESH_COOKIE_NAME,
        refresh,
        max_age=int(jwt_settings.REFRESH_TOKEN_LIFETIME.total_seconds()),
        httponly=True,
        secure=settings.SESSION_COOKIE_SECURE,
        samesite="Strict",
        path=REFRESH_COOKIE_PATH,
    )


def clear_refresh_cookie(response):
    response.delete_cookie(REFRESH_COOKIE_NAME, path=REFRESH_COOKIE_PATH, samesite="Strict")


class LocalizedTokenObtainPairView(TokenObtainPairView):
    serializer_class = LocalizedTokenObtainPairSerializer
    throttle_classes = (LoginRateThrottle, LoginIdentifierRateThrottle)

    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        refresh = response.data.pop("refresh", None) if response.status_code == 200 else None
        if refresh:
            set_refresh_cookie(response, refresh)
        return response


class CookieTokenRefreshView(TokenRefreshView):
    """Entrega un token de acceso nuevo a partir de la cookie de renovación.

    Los clientes que no son navegadores pueden seguir enviando ``refresh`` en
    el cuerpo; el portal web solo usa la cookie.
    """

    def post(self, request, *args, **kwargs):
        refresh = request.data.get("refresh") or request.COOKIES.get(REFRESH_COOKIE_NAME)
        if not refresh:
            raise InvalidToken(_("No hay una sesión que renovar."))
        serializer = self.get_serializer(data={"refresh": refresh})
        try:
            serializer.is_valid(raise_exception=True)
        except TokenError as error:
            raise InvalidToken(error.args[0]) from error
        return Response(serializer.validated_data, status=status.HTTP_200_OK)

    def finalize_response(self, request, response, *args, **kwargs):
        # Una cookie vencida o revocada no sirve de nada: se borra.
        if response.status_code == 401 and REFRESH_COOKIE_NAME in request.COOKIES:
            clear_refresh_cookie(response)
        return super().finalize_response(request, response, *args, **kwargs)


class LogoutView(APIView):
    """Revoca el token de renovación y borra su cookie.

    Tras cerrar sesión ese token ya no puede pedir más accesos, aunque alguien
    lo hubiera copiado. No exige estar autenticado: basta con la cookie.
    """

    authentication_classes = ()
    permission_classes = (permissions.AllowAny,)

    @extend_schema(request=None, responses={204: OpenApiTypes.NONE})
    def post(self, request):
        refresh = request.COOKIES.get(REFRESH_COOKIE_NAME) or request.data.get("refresh")
        if refresh:
            try:
                RefreshToken(refresh).blacklist()
            except TokenError:
                pass
        response = Response(status=status.HTTP_204_NO_CONTENT)
        clear_refresh_cookie(response)
        return response
