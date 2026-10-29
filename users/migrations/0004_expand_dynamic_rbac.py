from django.db import migrations


ADDITIONAL_PERMISSIONS = {
    "adoptante": (
        ("profile", "read"),
        ("profile", "update"),
        ("formQuestions", "read"),
        ("followUps", "read"),
        ("vaccines", "read"),
        ("messages", "read"),
        ("messages", "create"),
        ("messages", "update"),
        ("messages", "delete"),
        ("notifications", "update"),
    ),
    "refugio": (
        ("profile", "read"),
        ("profile", "update"),
        ("petPhotos", "read"),
        ("petPhotos", "create"),
        ("petPhotos", "delete"),
        ("shelterMembers", "read"),
        ("shelterMembers", "create"),
        ("shelterMembers", "update"),
        ("shelterMembers", "delete"),
        ("formQuestions", "read"),
        ("followUps", "read"),
        ("followUps", "create"),
        ("followUps", "update"),
        ("followUps", "delete"),
        ("vaccines", "read"),
        ("reminders", "read"),
        ("reminders", "create"),
        ("reminders", "update"),
        ("reminders", "delete"),
        ("messages", "read"),
        ("messages", "create"),
        ("messages", "update"),
        ("messages", "delete"),
        ("shelters", "create"),
        ("medicalRecords", "create"),
        ("medicalRecords", "update"),
        ("medicalRecords", "delete"),
        ("notifications", "update"),
    ),
    "veterinario": (
        ("profile", "read"),
        ("profile", "update"),
        ("veterinarians", "read"),
        ("veterinarians", "create"),
        ("veterinarians", "update"),
        ("vaccines", "read"),
        ("formQuestions", "read"),
        ("medicalRecords", "delete"),
        ("notifications", "update"),
    ),
    "administrador": (
        ("profile", "read"),
        ("profile", "update"),
        ("petPhotos", "manage"),
        ("shelterMembers", "manage"),
        ("formQuestions", "read"),
        ("followUps", "manage"),
        ("veterinarians", "manage"),
        ("vaccines", "read"),
        ("reminders", "manage"),
        ("messages", "manage"),
    ),
}


def add_default_permissions(apps, schema_editor):
    Role = apps.get_model("users", "Role")
    RolePermission = apps.get_model("users", "RolePermission")
    database = schema_editor.connection.alias
    roles = {
        role.name: role
        for role in Role.objects.using(database).all()
    }
    for role_name, permissions in ADDITIONAL_PERMISSIONS.items():
        role = roles.get(role_name)
        if role is not None:
            RolePermission.objects.using(database).bulk_create(
                [
                    RolePermission(role_id=role.pk, resource=resource, action=action)
                    for resource, action in permissions
                ],
                ignore_conflicts=True,
            )


class Migration(migrations.Migration):
    dependencies = [("users", "0003_rolepermission")]

    operations = [migrations.RunPython(add_default_permissions, migrations.RunPython.noop)]
