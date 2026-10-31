from django.db import migrations


def restore_admin_shelter_verification(apps, schema_editor):
    Role = apps.get_model("users", "Role")
    RolePermission = apps.get_model("users", "RolePermission")
    database = schema_editor.connection.alias
    admin_role = Role.objects.using(database).filter(name="administrador").first()
    if admin_role is not None:
        RolePermission.objects.using(database).get_or_create(
            role_id=admin_role.pk,
            resource="shelters",
            action="verify",
        )


class Migration(migrations.Migration):
    dependencies = [("users", "0008_username_email_verification_and_login_challenge")]

    operations = [
        migrations.RunPython(
            restore_admin_shelter_verification,
            migrations.RunPython.noop,
        )
    ]
