from django.db import migrations


def grant_species_catalog_management(apps, schema_editor):
    Role = apps.get_model("users", "Role")
    RolePermission = apps.get_model("users", "RolePermission")
    database = schema_editor.connection.alias
    admin_role = Role.objects.using(database).filter(name="administrador").first()
    if admin_role is not None:
        RolePermission.objects.using(database).get_or_create(
            role_id=admin_role.pk,
            resource="species",
            action="manage",
        )


class Migration(migrations.Migration):
    dependencies = [("users", "0017_user_photo_url")]

    operations = [
        migrations.RunPython(
            grant_species_catalog_management,
            migrations.RunPython.noop,
        )
    ]
