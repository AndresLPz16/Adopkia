"""Entrega del portal React compilado desde el mismo host que la API.

Solo se activa con `DJANGO_FRONTEND_DIST`. WhiteNoise sirve los archivos del
build (incluido `index.html` en `/`); esta vista cubre las rutas internas del
portal, que no existen como archivo y deben recibir el mismo `index.html`
para que React Router las resuelva al recargar la página.
"""

from pathlib import Path

from django.conf import settings
from django.http import FileResponse, Http404
from django.views.decorators.http import require_safe

# Rutas que maneja React Router. `/admin/permissions` es del portal, no del
# panel de administración de Django.
SPA_ROUTE_PATTERN = r"^(?:app(?:/.*)?|admin/permissions/?)$"


@require_safe
def spa_index(request):
    index_file = Path(settings.FRONTEND_DIST_DIR) / "index.html"
    if not index_file.is_file():
        raise Http404("El portal no está compilado.")
    response = FileResponse(index_file.open("rb"), content_type="text/html; charset=utf-8")
    # El HTML apunta a archivos con hash; no debe quedar en caché tras un despliegue.
    response["Cache-Control"] = "no-cache"
    return response
