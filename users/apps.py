from django.apps import AppConfig


class UsersConfig(AppConfig):
    name = 'users'

    def ready(self):
        from myproject.model_i18n import apply_localized_model_labels

        apply_localized_model_labels()

        from . import avatars  # noqa: F401  (registra la limpieza de fotos de perfil)
