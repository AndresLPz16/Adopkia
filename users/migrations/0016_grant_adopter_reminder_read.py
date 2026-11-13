from django.db import migrations


def grant_adopter_reminder_read(apps, schema_editor):
    """Permite al adoptante consultar los recordatorios de sus adopciones.

    La vista ya limita el listado a las adopciones propias; faltaba el
    permiso de rol, así que la API respondía 403.
    """
    Role = apps.get_model("users", "Role")
    RolePermission = apps.get_model("users", "RolePermission")
    database = schema_editor.connection.alias
    adopter_role = Role.objects.using(database).filter(name="adoptante").first()
    if adopter_role is None:
        return
    RolePermission.objects.using(database).bulk_create(
        [
            RolePermission(
                role_id=adopter_role.pk,
                resource="reminders",
                action="read",
            )
        ],
        ignore_conflicts=True,
    )


class Migration(migrations.Migration):
    dependencies = [("users", "0015_permissionresource")]

    operations = [
        migrations.RunPython(
            grant_adopter_reminder_read,
            migrations.RunPython.noop,
        )
    ]
