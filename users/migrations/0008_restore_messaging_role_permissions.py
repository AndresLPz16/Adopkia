from django.db import migrations


DEFAULT_MESSAGING_PERMISSIONS = {
    "adoptante": (
        ("conversations", "read"),
        ("conversations", "create"),
        ("messages", "read"),
        ("messages", "create"),
        ("messages", "update"),
        ("messages", "delete"),
    ),
    "refugio": (
        ("conversations", "read"),
        ("messages", "read"),
        ("messages", "create"),
        ("messages", "update"),
        ("messages", "delete"),
    ),
}


def restore_messaging_permissions(apps, schema_editor):
    Role = apps.get_model("users", "Role")
    RolePermission = apps.get_model("users", "RolePermission")
    database = schema_editor.connection.alias
    roles = {
        role.name: role
        for role in Role.objects.using(database).filter(
            name__in=DEFAULT_MESSAGING_PERMISSIONS
        )
    }
    RolePermission.objects.using(database).bulk_create(
        [
            RolePermission(role_id=roles[role_name].pk, resource=resource, action=action)
            for role_name, permissions in DEFAULT_MESSAGING_PERMISSIONS.items()
            if role_name in roles
            for resource, action in permissions
        ],
        ignore_conflicts=True,
    )


class Migration(migrations.Migration):
    dependencies = [("users", "0007_add_platform_superadmin")]

    operations = [
        migrations.RunPython(
            restore_messaging_permissions,
            migrations.RunPython.noop,
        )
    ]
