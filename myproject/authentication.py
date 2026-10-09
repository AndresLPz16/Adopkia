from django.utils.translation import gettext_lazy as _
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView


class LocalizedTokenObtainPairSerializer(TokenObtainPairSerializer):
    default_error_messages = {
        "no_active_account": _("Credenciales inválidas o cuenta inactiva.")
    }


class LocalizedTokenObtainPairView(TokenObtainPairView):
    serializer_class = LocalizedTokenObtainPairSerializer
