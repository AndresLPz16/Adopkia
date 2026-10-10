from django.apps import AppConfig


class MessagingConfig(AppConfig):
    name = 'messaging'

    def ready(self):
        from . import signals  # noqa: F401  # Register model signal receivers.
