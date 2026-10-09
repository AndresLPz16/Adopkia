from django.core.management.base import BaseCommand
from django.db import transaction

from adoptions.models import FormQuestion
from medical.models import Vaccine
from pets.models import Breed, Species
from users.models import Role


ROLES = (
    ("adoptante", "Persona que solicita adoptar una mascota"),
    ("refugio", "Integrante de un refugio o protectora"),
    ("administrador", "Verifica refugios y supervisa la plataforma"),
    ("veterinario", "Veterinario aliado que registra atenciones médicas"),
)

BREEDS = {
    "Perro": (
        "Mestizo",
        "Labrador Retriever",
        "Golden Retriever",
        "Pastor Alemán",
        "Pitbull",
        "Chihuahua",
        "Schnauzer",
        "Poodle",
    ),
    "Gato": ("Mestizo", "Siamés", "Persa", "Angora", "Maine Coon"),
}

VACCINES = {
    "Perro": (
        ("Antirrábica", "Protege contra la rabia", 365),
        ("Polivalente canina", "Moquillo, parvovirus, hepatitis y leptospirosis", 365),
        ("Bordetella", "Tos de las perreras", 365),
    ),
    "Gato": (
        ("Antirrábica", "Protege contra la rabia", 365),
        ("Triple felina", "Panleucopenia, calicivirus y rinotraqueítis", 365),
        ("Leucemia felina", "Protege contra el virus de la leucemia felina", 365),
    ),
}

QUESTIONS = (
    ("¿Por qué quieres adoptar una mascota?", "texto", True, 1),
    ("¿Has tenido mascotas antes?", "si_no", True, 2),
    ("¿Cuántas personas viven en tu hogar?", "numero", True, 3),
    ("¿Tu vivienda es casa o apartamento, y es propia o arrendada?", "texto", True, 4),
    ("¿Tienes patio o un espacio cerrado para la mascota?", "si_no", True, 5),
    ("¿Todas las personas de tu hogar están de acuerdo con la adopción?", "si_no", True, 6),
    ("¿Cuántas horas al día estaría sola la mascota?", "numero", True, 7),
    ("¿Tienes otras mascotas actualmente? Si es así, ¿cuáles?", "texto", False, 8),
    ("¿Quién se haría cargo de los gastos veterinarios?", "texto", True, 9),
    ("¿Aceptas recibir visitas o llamadas de seguimiento después de la adopción?", "si_no", True, 10),
)


class Command(BaseCommand):
    help = "Carga los catálogos y preguntas definidos en database/adopkia_v3.sql."

    @transaction.atomic
    def handle(self, *args, **options):
        for name, description in ROLES:
            Role.objects.get_or_create(name=name, defaults={"description": description})

        species_by_name = {}
        for name in BREEDS:
            species_by_name[name], _ = Species.objects.get_or_create(name=name)

        for species_name, breed_names in BREEDS.items():
            for breed_name in breed_names:
                Breed.objects.get_or_create(
                    species=species_by_name[species_name], name=breed_name
                )

        for species_name, vaccines in VACCINES.items():
            species = species_by_name[species_name]
            for name, description, interval in vaccines:
                Vaccine.objects.get_or_create(
                    species=species,
                    name=name,
                    defaults={
                        "description": description,
                        "booster_interval_days": interval,
                    },
                )

        for prompt, answer_type, required, order in QUESTIONS:
            FormQuestion.objects.get_or_create(
                prompt=prompt,
                defaults={
                    "answer_type": answer_type,
                    "required": required,
                    "order": order,
                },
            )

        self.stdout.write(
            self.style.SUCCESS(
                "Catálogos cargados: 2 especies, 13 razas, 6 vacunas y 10 preguntas."
            )
        )
