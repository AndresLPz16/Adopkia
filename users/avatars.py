"""Foto de perfil de la cuenta: guardado y limpieza del archivo.

Mismo esquema que las fotos de mascotas: el archivo va al almacenamiento
configurado (disco local o Azure Blob Storage) y en la base solo queda su URL.
"""
import logging
import re
from uuid import uuid4

from django.core.files.storage import default_storage
from django.db import transaction
from django.db.models.signals import post_delete
from django.dispatch import receiver

from .models import User

logger = logging.getLogger(__name__)

AVATAR_FORMATS = {"JPEG": "jpg", "PNG": "png", "WEBP": "webp"}
AVATAR_MAX_BYTES = 5 * 1024 * 1024

# Nombre con el que `save_avatar` guarda un archivo subido.
AVATAR_NAME = re.compile(r"^avatars/[0-9a-f]{32}\.(?:jpg|png|webp)$")


def avatar_name(url):
    """Devuelve el nombre en el almacenamiento de una foto de perfil subida.

    Solo reconoce una URL que apunte al almacenamiento configurado y tenga el
    nombre que genera `save_avatar`; cualquier otra devuelve `None`.
    """
    # Se pregunta por un nombre de archivo y no por la carpeta: el almacenamiento
    # de Azure normaliza el nombre y quita la barra final de "avatars/".
    probe = default_storage.url("avatars/_").split("?", 1)[0]
    if not probe.endswith("avatars/_"):
        return None
    prefix = probe[:-1]
    location = (url or "").split("?", 1)[0]
    if not location.startswith(prefix):
        return None
    name = "avatars/" + location[len(prefix):]
    return name if AVATAR_NAME.fullmatch(name) else None


def save_avatar(image):
    """Guarda la imagen ya validada y devuelve `(nombre, url)`."""
    extension = AVATAR_FORMATS[image.image.format]
    name = default_storage.save(f"avatars/{uuid4().hex}.{extension}", image)
    return name, default_storage.url(name)


def delete_avatar_file(url):
    """Borra el archivo de una foto de perfil al confirmar la transacción.

    Un fallo del almacenamiento no debe impedir el cambio en la cuenta: se
    anota y el archivo queda huérfano.
    """
    name = avatar_name(url)
    if name is None:
        return

    def remove():
        if User.objects.filter(photo_url=url).exists():
            return
        try:
            default_storage.delete(name)
        except Exception:
            logger.exception("No se pudo eliminar la foto de perfil %s", name)

    transaction.on_commit(remove)


@receiver(post_delete, sender=User)
def delete_avatar_with_user(sender, instance, **kwargs):
    """Al eliminar la cuenta se elimina también su foto."""
    delete_avatar_file(instance.photo_url)
