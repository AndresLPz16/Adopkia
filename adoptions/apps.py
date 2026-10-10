from django.apps import AppConfig


class AdoptionsConfig(AppConfig):
    name = 'adoptions'

    def ready(self):
        from . import signals  # noqa: F401  # Register model signal receivers.
