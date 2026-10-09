from django.db import migrations


ROLE_ROWS = (
    ("adoptante", "Persona que solicita adoptar una mascota"),
    ("refugio", "Integrante de un refugio o protectora"),
    ("administrador", "Verifica refugios y supervisa la plataforma"),
    ("veterinario", "Veterinario aliado que registra atenciones médicas"),
)


def create_roles(apps, schema_editor):
    Role = apps.get_model("users", "Role")
    alias = schema_editor.connection.alias
    for name, description in ROLE_ROWS:
        Role.objects.using(alias).get_or_create(
            name=name, defaults={"description": description}
        )


def remove_roles(apps, schema_editor):
    Role = apps.get_model("users", "Role")
    Role.objects.using(schema_editor.connection.alias).filter(
        name__in=[name for name, _description in ROLE_ROWS]
    ).delete()


class Migration(migrations.Migration):
    dependencies = [("users", "0001_initial")]

    operations = [migrations.RunPython(create_roles, remove_roles)]
