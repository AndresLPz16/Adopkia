from django.db import migrations


def add_adoption_return_permission(apps, schema_editor):
    Role = apps.get_model("users", "Role")
    RolePermission = apps.get_model("users", "RolePermission")
    database = schema_editor.connection.alias
    shelter_role = Role.objects.using(database).filter(name="refugio").first()
    if shelter_role is not None:
        RolePermission.objects.using(database).get_or_create(
            role_id=shelter_role.pk,
            resource="adoptions",
            action="return",
        )


class Migration(migrations.Migration):
    dependencies = [("users", "0004_expand_dynamic_rbac")]

    operations = [
        migrations.RunPython(
            add_adoption_return_permission,
            migrations.RunPython.noop,
        )
    ]
