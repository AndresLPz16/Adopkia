import re
import uuid

from django.db import migrations, models
import django.db.models.deletion
from django.utils import timezone


def backfill_username_and_verified_email(apps, schema_editor):
    User = apps.get_model("users", "User")
    database = schema_editor.connection.alias
    for user in User.objects.using(database).only("id", "email").order_by("id").iterator():
        local_part = user.email.split("@", 1)[0].lower()
        base = re.sub(r"[^a-z0-9_.-]", "_", local_part).strip("._-") or "usuario"
        if not base[0].isalnum():
            base = f"u{base}"
        base = base[:30]
        candidate = base
        suffix = 1
        while User.objects.using(database).filter(username__iexact=candidate).exists():
            suffix_text = str(suffix)
            candidate = f"{base[:30 - len(suffix_text)]}{suffix_text}"
            suffix += 1
        user.username = candidate
        user.email_verified = True
        user.save(using=database, update_fields=("username", "email_verified"))


class Migration(migrations.Migration):
    dependencies = [("users", "0007_add_platform_superadmin")]

    operations = [
        migrations.AddField(
            model_name="user",
            name="username",
            field=models.CharField(
                db_column="nombre_usuario",
                max_length=30,
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="user",
            name="email_verified",
            field=models.BooleanField(db_column="correo_verificado", default=False),
        ),
        migrations.RunPython(backfill_username_and_verified_email, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="user",
            name="username",
            field=models.CharField(
                db_column="nombre_usuario",
                max_length=30,
                unique=True,
            ),
        ),
        migrations.CreateModel(
            name="EmailVerificationCode",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("code_hash", models.CharField(db_column="codigo_hash", max_length=64)),
                ("expires_at", models.DateTimeField(db_column="expira_en")),
                (
                    "failed_attempts",
                    models.PositiveSmallIntegerField(
                        db_column="intentos_fallidos",
                        default=0,
                    ),
                ),
                (
                    "sent_at",
                    models.DateTimeField(db_column="enviado_en", default=timezone.now),
                ),
                (
                    "user",
                    models.OneToOneField(
                        db_column="id_usuario",
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="email_verification_code",
                        to="users.user",
                    ),
                ),
            ],
            options={"db_table": "codigo_verificacion_correo"},
        ),
        migrations.CreateModel(
            name="LoginMathChallenge",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        db_column="id_reto",
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ("answer_hash", models.CharField(db_column="respuesta_hash", max_length=64)),
                ("expires_at", models.DateTimeField(db_column="expira_en")),
            ],
            options={"db_table": "reto_matematico_login"},
        ),
    ]
