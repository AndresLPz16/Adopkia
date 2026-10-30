from django.db.models import Q
from django.utils.translation import gettext_lazy as _
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView

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


class LocalizedTokenObtainPairView(TokenObtainPairView):
    serializer_class = LocalizedTokenObtainPairSerializer
