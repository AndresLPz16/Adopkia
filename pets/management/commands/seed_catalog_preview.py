from django.core.management.base import BaseCommand, CommandError
from django.db import connection, transaction
from django.utils import timezone

from shelters.models import Shelter
from users.models import Role, User

from pets.models import Breed, Pet, PetPhoto, Species


SHELTER_NAME = "Adopkia · Refugio de muestra"
SHELTER_CITY = "Riohacha"
SAMPLE_HEALTH_NOTE = (
    "Perfil ficticio de demostración; no corresponde a una mascota real."
)
SAMPLE_PETS = (
    {
        "name": "Luna",
        "species": "Perro",
        "breed": "Mestizo",
        "size": Pet.Size.MEDIUM,
        "birth_date": "2022-10-12",
        "temperament": "Cariñosa, tranquila y lista para compartir aventuras.",
        "image": "/demo-pets/luna.svg",
    },
    {
        "name": "Toby",
        "species": "Perro",
        "breed": "Golden Retriever",
        "size": Pet.Size.LARGE,
        "birth_date": "2021-08-03",
        "temperament": "Juguetón y sociable; disfruta los paseos al aire libre.",
        "image": "/demo-pets/toby.svg",
    },
    {
        "name": "Canela",
        "species": "Perro",
        "breed": "Schnauzer",
        "size": Pet.Size.SMALL,
        "birth_date": "2023-02-20",
        "temperament": "Curiosa, dulce y feliz de conocer personas nuevas.",
        "image": "/demo-pets/canela.svg",
    },
    {
        "name": "Milo",
        "species": "Gato",
        "breed": "Mestizo",
        "size": Pet.Size.SMALL,
        "birth_date": "2023-06-15",
        "temperament": "Dulce y relajado; experto en siestas y ronroneos.",
        "image": "/demo-pets/milo.svg",
    },
    {
        "name": "Nala",
        "species": "Gato",
        "breed": "Siamés",
        "size": Pet.Size.SMALL,
        "birth_date": "2022-11-06",
        "temperament": "Sociable y expresiva; siempre acompaña de cerca.",
        "image": "/demo-pets/nala.svg",
    },
    {
        "name": "Simón",
        "species": "Gato",
        "breed": "Mestizo",
        "size": Pet.Size.MEDIUM,
        "birth_date": "2021-12-01",
        "temperament": "Sereno y amable; busca un rincón soleado para descansar.",
        "image": "/demo-pets/simon.svg",
    },
)


class Command(BaseCommand):
    help = (
        "Adds or removes clearly labeled local-only sample pets for previewing "
        "the public catalog."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--remove",
            action="store_true",
            help="Remove only the sample shelter, pets, and photos created by this command.",
        )

    def handle(self, *args, **options):
        self.ensure_local_database()
        if options["remove"]:
            self.remove_samples()
            return
        self.create_samples()

    def ensure_local_database(self):
        if connection.vendor == "sqlite":
            return
        if connection.vendor == "mysql":
            host = connection.settings_dict.get("HOST", "")
            if host in {"", "localhost", "127.0.0.1", "::1"}:
                return
        raise CommandError(
            "Este comando solo puede ejecutarse contra SQLite local o MySQL local."
        )

    @transaction.atomic
    def create_samples(self):
        verifier = (
            User.objects.filter(role__name=Role.Name.ADMIN)
            .order_by("-is_platform_superadmin", "id")
            .first()
        )
        if verifier is None:
            raise CommandError(
                "Se necesita una cuenta administradora local para verificar el "
                "refugio de muestra."
            )

        shelter, _ = Shelter.objects.update_or_create(
            name=SHELTER_NAME,
            city=SHELTER_CITY,
            defaults={
                "address": "Dirección ficticia para vista previa",
                "contact_phone": None,
                "contact_email": None,
                "verification_status": Shelter.VerificationStatus.VERIFIED,
                "verification_date": timezone.now(),
                "verified_by": verifier,
            },
        )

        for item in SAMPLE_PETS:
            species = Species.objects.filter(name=item["species"]).first()
            if species is None:
                raise CommandError(
                    f"Falta la especie de catálogo: {item['species']}. "
                    "Ejecuta primero seed_data."
                )
            breed = Breed.objects.filter(
                species=species,
                name=item["breed"],
            ).first()
            if breed is None:
                raise CommandError(
                    f"Falta la raza de catálogo: {item['breed']}. "
                    "Ejecuta primero seed_data."
                )

            pet, _ = Pet.objects.update_or_create(
                shelter=shelter,
                name=item["name"],
                defaults={
                    "breed": breed,
                    "approximate_birth_date": item["birth_date"],
                    "size": item["size"],
                    "health": SAMPLE_HEALTH_NOTE,
                    "temperament": item["temperament"],
                    "status": Pet.Status.AVAILABLE,
                },
            )
            PetPhoto.objects.update_or_create(
                pet=pet,
                url=item["image"],
                defaults={"is_primary": True},
            )

        self.stdout.write(
            self.style.SUCCESS(
                f"Catálogo local listo: {len(SAMPLE_PETS)} perfiles ficticios "
                f"en {SHELTER_NAME} ({SHELTER_CITY})."
            )
        )

    @transaction.atomic
    def remove_samples(self):
        shelter = Shelter.objects.filter(
            name=SHELTER_NAME,
            city=SHELTER_CITY,
        ).first()
        if shelter is None:
            self.stdout.write("No se encontraron registros de muestra para quitar.")
            return

        sample_names = [item["name"] for item in SAMPLE_PETS]
        pets = Pet.objects.filter(
            shelter=shelter,
            health=SAMPLE_HEALTH_NOTE,
            name__in=sample_names,
        )
        pet_count = pets.count()
        PetPhoto.objects.filter(pet__in=pets).delete()
        pets.delete()

        if shelter.pets.exists() or shelter.members.exists():
            raise CommandError(
                "El refugio de muestra tiene otros registros asociados; no se eliminó."
            )
        shelter.delete()
        self.stdout.write(
            self.style.SUCCESS(
                f"Se quitaron {pet_count} perfiles ficticios y su refugio de muestra."
            )
        )
