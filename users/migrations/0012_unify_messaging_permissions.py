from django.db import migrations


def unify_messaging_permissions(apps, schema_editor):
    RolePermission = apps.get_model("users", "RolePermission")
    database = schema_editor.connection.alias
    for role_id in (
        RolePermission.objects.using(database)
        .filter(resource__in=("conversations", "messages", "messaging"))
        .values_list("role_id", flat=True)
        .distinct()
    ):
        actions = set(
            RolePermission.objects.using(database)
            .filter(role_id=role_id, resource__in=("conversations", "messages", "messaging"))
            .values_list("action", flat=True)
        )
        RolePermission.objects.using(database).bulk_create(
            [
                RolePermission(role_id=role_id, resource="messaging", action=action)
                for action in actions
            ],
            ignore_conflicts=True,
        )
        RolePermission.objects.using(database).filter(
            role_id=role_id,
            resource__in=("conversations", "messages"),
        ).delete()


def split_messaging_permissions(apps, schema_editor):
    RolePermission = apps.get_model("users", "RolePermission")
    database = schema_editor.connection.alias
    for role_id in (
        RolePermission.objects.using(database)
        .filter(resource="messaging")
        .values_list("role_id", flat=True)
        .distinct()
    ):
        actions = RolePermission.objects.using(database).filter(
            role_id=role_id,
            resource="messaging",
        ).values_list("action", flat=True)
        RolePermission.objects.using(database).bulk_create(
            [
                RolePermission(role_id=role_id, resource=resource, action=action)
                for resource in ("conversations", "messages")
                for action in actions
            ],
            ignore_conflicts=True,
        )
        RolePermission.objects.using(database).filter(
            role_id=role_id,
            resource="messaging",
        ).delete()


class Migration(migrations.Migration):
    dependencies = [("users", "0011_grant_vaccine_catalog_management")]

    operations = [
        migrations.RunPython(
            unify_messaging_permissions,
            split_messaging_permissions,
        )
    ]
