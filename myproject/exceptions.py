from django.db import DatabaseError
from django.utils.translation import gettext as _
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler

from myproject.i18n import trigger_message


def api_exception_handler(exc, context):
    response = drf_exception_handler(exc, context)
    if response is not None:
        return response

    if isinstance(exc, DatabaseError) and exc.args and exc.args[0] == 1644:
        detail = str(exc.args[1]) if len(exc.args) > 1 else _("Regla de integridad incumplida.")
        detail = trigger_message(detail)
        return Response(
            {
                "detail": _("La operación fue rechazada por una regla de integridad: %(detail)s")
                % {"detail": detail}
            },
            status=status.HTTP_400_BAD_REQUEST,
        )
    return None
