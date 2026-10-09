from datetime import date

from django.db import models

from myproject.db_fields import EnumField, SQLDateTimeField, SQLTextField
from shelters.models import Shelter


class Species(models.Model):
    id = models.AutoField(primary_key=True, db_column="id_especie")
    name = models.CharField(max_length=50, unique=True, db_column="nombre")

    class Meta:
        db_table = "especie"
        ordering = ("id",)

    def __str__(self):
        return self.name


class Breed(models.Model):
    id = models.AutoField(primary_key=True, db_column="id_raza")
    species = models.ForeignKey(
        Species, on_delete=models.DO_NOTHING, related_name="breeds", db_column="id_especie"
    )
    name = models.CharField(max_length=80, db_column="nombre")

    class Meta:
        db_table = "raza"
        ordering = ("id",)
        constraints = [
            models.UniqueConstraint(fields=("species", "name"), name="uq_raza_especie_nombre")
        ]

    def __str__(self):
        return self.name


class Pet(models.Model):
    class Size(models.TextChoices):
        SMALL = "pequeno", "Pequeño"
        MEDIUM = "mediano", "Mediano"
        LARGE = "grande", "Grande"

    class Status(models.TextChoices):
        AVAILABLE = "disponible", "Disponible"
        IN_PROCESS = "en_proceso", "En proceso"
        ADOPTED = "adoptada", "Adoptada"
        RETURNED = "devuelta", "Devuelta"

    id = models.AutoField(primary_key=True, db_column="id_mascota")
    shelter = models.ForeignKey(
        Shelter, on_delete=models.DO_NOTHING, related_name="pets", db_column="id_refugio"
    )
    breed = models.ForeignKey(
        Breed, on_delete=models.DO_NOTHING, related_name="pets", db_column="id_raza"
    )
    name = models.CharField(max_length=80, db_column="nombre")
    approximate_birth_date = models.DateField(
        null=True, db_column="fecha_nacimiento_aprox"
    )
    size = EnumField(max_length=10, choices=Size.choices, db_column="tamano")
    health = SQLTextField(null=True, db_column="salud")
    temperament = models.CharField(max_length=150, null=True, db_column="temperamento")
    status = EnumField(
        max_length=20,
        choices=Status.choices,
        default=Status.AVAILABLE,
        db_column="estado",
    )
    published_at = SQLDateTimeField(auto_now_add=True, db_column="fecha_publicacion")

    class Meta:
        db_table = "mascota"
        ordering = ("-published_at",)
        indexes = [
            models.Index(fields=("status",), name="idx_mascota_estado"),
            models.Index(fields=("size",), name="idx_mascota_tamano"),
        ]

    @property
    def age(self):
        if self.approximate_birth_date is None:
            return None
        today = date.today()
        return (
            today.year
            - self.approximate_birth_date.year
            - (
                (today.month, today.day)
                < (self.approximate_birth_date.month, self.approximate_birth_date.day)
            )
        )

    @property
    def species(self):
        return self.breed.species

    def __str__(self):
        return self.name


class PetPhoto(models.Model):
    id = models.AutoField(primary_key=True, db_column="id_foto")
    pet = models.ForeignKey(
        Pet, on_delete=models.CASCADE, related_name="photos", db_column="id_mascota"
    )
    url = models.CharField(max_length=500, db_column="url")
    is_primary = models.BooleanField(default=False, db_column="es_principal")
    uploaded_at = SQLDateTimeField(auto_now_add=True, db_column="fecha_subida")

    class Meta:
        db_table = "foto_mascota"
        ordering = ("-is_primary", "id")

    def __str__(self):
        return f"Photo of {self.pet}"
