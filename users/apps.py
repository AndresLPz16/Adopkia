from django.apps import AppConfig


class UsersConfig(AppConfig):
    name = 'users'

    def ready(self):
        from myproject.model_i18n import apply_localized_model_labels

        apply_localized_model_labels()
