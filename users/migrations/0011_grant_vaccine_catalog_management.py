from django.db import migrations


def grant_vaccine_catalog_management(apps, schema_editor):
    Role = apps.get_model("users", "Role")
    RolePermission = apps.get_model("users", "RolePermission")
    database = schema_editor.connection.alias
    admin_role = Role.objects.using(database).filter(name="administrador").first()
    if admin_role is not None:
        RolePermission.objects.using(database).get_or_create(
            role_id=admin_role.pk,
            resource="vaccines",
            action="manage",
        )


class Migration(migrations.Migration):
    dependencies = [("users", "0010_grant_form_question_management")]

    operations = [
        migrations.RunPython(
            grant_vaccine_catalog_management,
            migrations.RunPython.noop,
        )
    ]
