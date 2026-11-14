import logging
import re

from django.core.files.storage import default_storage
from django.db import transaction
from django.db.models.signals import post_delete
from django.dispatch import receiver

from .models import PetPhoto

logger = logging.getLogger(__name__)

# Nombre con el que `PetPhotoWriteSerializer` guarda un archivo subido.
UPLOADED_PHOTO_NAME = re.compile(r"^pets/[0-9a-f]{32}\.(?:jpg|png|webp|gif)$")


def uploaded_photo_name(url):
    """Devuelve el nombre en el almacenamiento de una foto subida como archivo.

    Las fotos registradas con un enlace externo no nos pertenecen y devuelven
    `None`: solo se reconoce una URL que apunte al almacenamiento configurado y
    tenga el nombre que genera la subida de archivos.
    """
    # Se pregunta por un nombre de archivo y no por la carpeta: el almacenamiento
    # de Azure normaliza el nombre y quita la barra final de "pets/".
    probe = default_storage.url("pets/_").split("?", 1)[0]
    if not probe.endswith("pets/_"):
        return None
    prefix = probe[:-1]
    location = (url or "").split("?", 1)[0]
    if not location.startswith(prefix):
        return None
    name = "pets/" + location[len(prefix):]
    return name if UPLOADED_PHOTO_NAME.fullmatch(name) else None


@receiver(post_delete, sender=PetPhoto)
def delete_uploaded_photo_file(sender, instance, **kwargs):
    """Elimina el archivo al borrar la foto, también al borrar la mascota.

    Se ejecuta al confirmar la transacción, para no perder el archivo si el
    borrado se revierte. Un fallo del almacenamiento no debe impedir el borrado
    del registro: se anota y el archivo queda huérfano.
    """
    name = uploaded_photo_name(instance.url)
    if name is None:
        return
    url = instance.url

    def remove():
        if PetPhoto.objects.filter(url=url).exists():
            return
        try:
            default_storage.delete(name)
        except Exception:
            logger.exception("No se pudo eliminar el archivo de la foto %s", name)

    transaction.on_commit(remove)
