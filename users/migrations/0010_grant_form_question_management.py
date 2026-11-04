from django.db import migrations


def grant_form_question_management(apps, schema_editor):
    Role = apps.get_model("users", "Role")
    RolePermission = apps.get_model("users", "RolePermission")
    database = schema_editor.connection.alias
    grants = []
    shelter_role = Role.objects.using(database).filter(name="refugio").first()
    if shelter_role is not None:
        grants.extend(
            RolePermission(
                role_id=shelter_role.pk,
                resource="formQuestions",
                action=action,
            )
            for action in ("create", "update", "delete")
        )
    admin_role = Role.objects.using(database).filter(name="administrador").first()
    if admin_role is not None:
        grants.append(
            RolePermission(
                role_id=admin_role.pk,
                resource="formQuestions",
                action="manage",
            )
        )
    RolePermission.objects.using(database).bulk_create(
        grants,
        ignore_conflicts=True,
    )


class Migration(migrations.Migration):
    dependencies = [("users", "0009_restore_admin_shelter_verification")]

    operations = [
        migrations.RunPython(
            grant_form_question_management,
            migrations.RunPython.noop,
        )
    ]
