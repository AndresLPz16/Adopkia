import json
from pathlib import Path
from tempfile import TemporaryDirectory

from django.core.management import call_command
from django.core.management.base import BaseCommand

from adoptions.models import FormQuestion
from medical.models import Vaccine
from pets.models import Breed
from users.management.commands.seed_data import BREEDS, VACCINES
from users.models import User


class Command(BaseCommand):
    help = "Loads the shared demonstration dataset into a new database."

    def handle(self, *args, **options):
        if User.objects.exists():
            self.stdout.write("Demo data was not loaded because users already exist.")
            return

        call_command(
            "seed_data",
            verbosity=options["verbosity"],
            stdout=self.stdout,
            stderr=self.stderr,
        )

        breed_ids = {
            fixture_id: Breed.objects.get(species__name=species_name, name=breed_name).pk
            for fixture_id, (species_name, breed_name) in enumerate(
                (
                    (species_name, breed_name)
                    for species_name, breed_names in BREEDS.items()
                    for breed_name in breed_names
                ),
                start=1,
            )
        }
        vaccine_ids = {
            fixture_id: Vaccine.objects.get(species__name=species_name, name=name).pk
            for fixture_id, (species_name, name) in enumerate(
                (
                    (species_name, name)
                    for species_name, vaccines in VACCINES.items()
                    for name, _description, _interval in vaccines
                ),
                start=1,
            )
        }
        question_ids = dict(
            FormQuestion.objects.values_list("order", "pk")
        )

        fixture_path = Path(__file__).resolve().parents[2] / "fixtures" / "demo_data.json"
        with fixture_path.open(encoding="utf-8") as fixture_file:
            fixture = json.load(fixture_file)

        for item in fixture:
            model = item["model"]
            fields = item["fields"]
            if model == "pets.pet":
                fields["breed"] = breed_ids[fields["breed"]]
            elif model in ("medical.medicalrecord", "medical.reminder"):
                if fields["vaccine"] is not None:
                    fields["vaccine"] = vaccine_ids[fields["vaccine"]]
            elif model == "adoptions.formanswer":
                question_id = question_ids[fields["question"]]
                fields["question"] = question_id
                item["pk"][1] = question_id

        with TemporaryDirectory() as temp_dir:
            normalized_fixture = Path(temp_dir) / "demo_data.json"
            with normalized_fixture.open("w", encoding="utf-8") as fixture_file:
                json.dump(fixture, fixture_file, ensure_ascii=False)
            call_command(
                "loaddata",
                str(normalized_fixture),
                verbosity=options["verbosity"],
                stdout=self.stdout,
                stderr=self.stderr,
            )
        self.stdout.write(self.style.SUCCESS("Demonstration data loaded."))
