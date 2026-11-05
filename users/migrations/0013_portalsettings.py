from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("users", "0012_unify_messaging_permissions")]

    operations = [
        migrations.CreateModel(
            name="PortalSettings",
            fields=[
                (
                    "id",
                    models.PositiveSmallIntegerField(default=1, primary_key=True, serialize=False),
                ),
                (
                    "sidebar_labels",
                    models.JSONField(db_column="etiquetas_menu_lateral", default=dict),
                ),
            ],
            options={"db_table": "configuracion_portal"},
        ),
    ]
