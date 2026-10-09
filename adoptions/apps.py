from django.apps import AppConfig


class AdoptionsConfig(AppConfig):
    name = 'adoptions'

    def ready(self):
        from . import signals
