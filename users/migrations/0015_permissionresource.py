from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("users", "0014_role_permissions_management")]

    operations = [
        migrations.CreateModel(
            name="PermissionResource",
            fields=[
                (
                    "key",
                    models.CharField(
                        db_column="clave",
                        max_length=40,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ("label", models.CharField(db_column="etiqueta", max_length=60)),
                ("actions", models.JSONField(db_column="acciones", default=list)),
            ],
            options={
                "db_table": "recurso_permiso",
                "ordering": ("label", "key"),
            },
        ),
    ]
