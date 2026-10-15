from django.core.management import call_command
from django.core.management.base import BaseCommand

from users.models import User


class Command(BaseCommand):
    help = "Loads the shared demonstration dataset into a new database."

    def handle(self, *args, **options):
        if User.objects.exists():
            self.stdout.write("Demo data was not loaded because users already exist.")
            return

        call_command("loaddata", "demo_data.json", verbosity=options["verbosity"])
        self.stdout.write(self.style.SUCCESS("Demonstration data loaded."))
