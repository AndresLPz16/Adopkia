from django.db import migrations


def grant_role_permissions_management(apps, schema_editor):
    Role = apps.get_model("users", "Role")
    RolePermission = apps.get_model("users", "RolePermission")
    database = schema_editor.connection.alias
    admin_role = Role.objects.using(database).filter(name="administrador").first()
    if admin_role is not None:
        RolePermission.objects.using(database).get_or_create(
            role_id=admin_role.pk,
            resource="rolePermissions",
            action="manage",
        )


def revoke_role_permissions_management(apps, schema_editor):
    Role = apps.get_model("users", "Role")
    RolePermission = apps.get_model("users", "RolePermission")
    database = schema_editor.connection.alias
    admin_role = Role.objects.using(database).filter(name="administrador").first()
    if admin_role is not None:
        RolePermission.objects.using(database).filter(
            role_id=admin_role.pk,
            resource="rolePermissions",
            action="manage",
        ).delete()


class Migration(migrations.Migration):
    dependencies = [("users", "0013_portalsettings")]

    operations = [
        migrations.RunPython(
            grant_role_permissions_management,
            revoke_role_permissions_management,
        )
    ]
