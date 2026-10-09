from django.db import migrations


FOREIGN_KEYS = (
    ("usuario", "fk_usuario_rol", "id_rol", "rol", "id_rol", "RESTRICT"),
    ("refugio", "fk_refugio_admin", "id_admin_verificador", "usuario", "id_usuario", "RESTRICT"),
    ("miembro_refugio", "fk_miembro_refugio", "id_refugio", "refugio", "id_refugio", "CASCADE"),
    ("miembro_refugio", "fk_miembro_usuario", "id_usuario", "usuario", "id_usuario", "CASCADE"),
    ("veterinario", "fk_veterinario_usuario", "id_usuario", "usuario", "id_usuario", "CASCADE"),
    ("raza", "fk_raza_especie", "id_especie", "especie", "id_especie", "RESTRICT"),
    ("mascota", "fk_mascota_refugio", "id_refugio", "refugio", "id_refugio", "RESTRICT"),
    ("mascota", "fk_mascota_raza", "id_raza", "raza", "id_raza", "RESTRICT"),
    ("foto_mascota", "fk_foto_mascota", "id_mascota", "mascota", "id_mascota", "CASCADE"),
    ("solicitud_adopcion", "fk_solicitud_adoptante", "id_adoptante", "usuario", "id_usuario", "RESTRICT"),
    ("solicitud_adopcion", "fk_solicitud_mascota", "id_mascota", "mascota", "id_mascota", "RESTRICT"),
    ("respuesta", "fk_respuesta_solicitud", "id_solicitud", "solicitud_adopcion", "id_solicitud", "CASCADE"),
    ("respuesta", "fk_respuesta_pregunta", "id_pregunta", "pregunta_formulario", "id_pregunta", "RESTRICT"),
    ("adopcion", "fk_adopcion_solicitud", "id_solicitud", "solicitud_adopcion", "id_solicitud", "RESTRICT"),
    ("seguimiento", "fk_seguimiento_adopcion", "id_adopcion", "adopcion", "id_adopcion", "CASCADE"),
    ("seguimiento", "fk_seguimiento_usuario", "id_registrado_por", "usuario", "id_usuario", "SET NULL"),
    ("vacuna", "fk_vacuna_especie", "id_especie", "especie", "id_especie", "RESTRICT"),
    ("historial_medico", "fk_historial_mascota", "id_mascota", "mascota", "id_mascota", "CASCADE"),
    ("historial_medico", "fk_historial_veterinario", "id_veterinario", "veterinario", "id_veterinario", "SET NULL"),
    ("historial_medico", "fk_historial_vacuna", "id_vacuna", "vacuna", "id_vacuna", "RESTRICT"),
    ("recordatorio", "fk_recordatorio_adopcion", "id_adopcion", "adopcion", "id_adopcion", "CASCADE"),
    ("recordatorio", "fk_recordatorio_vacuna", "id_vacuna", "vacuna", "id_vacuna", "RESTRICT"),
    ("recordatorio", "fk_recordatorio_historial", "id_historial", "historial_medico", "id_historial", "SET NULL"),
    ("notificacion", "fk_notif_usuario", "id_usuario", "usuario", "id_usuario", "CASCADE"),
    ("notificacion", "fk_notif_solicitud", "id_solicitud", "solicitud_adopcion", "id_solicitud", "SET NULL"),
    ("notificacion", "fk_notif_recordatorio", "id_recordatorio", "recordatorio", "id_recordatorio", "SET NULL"),
    ("conversacion", "fk_conv_adoptante", "id_adoptante", "usuario", "id_usuario", "CASCADE"),
    ("conversacion", "fk_conv_refugio", "id_refugio", "refugio", "id_refugio", "CASCADE"),
    ("conversacion", "fk_conv_mascota", "id_mascota", "mascota", "id_mascota", "SET NULL"),
    ("mensaje", "fk_mensaje_conversacion", "id_conversacion", "conversacion", "id_conversacion", "CASCADE"),
    ("mensaje", "fk_mensaje_remitente", "id_remitente", "usuario", "id_usuario", "RESTRICT"),
)


def _set_foreign_key_actions(schema_editor, reverse=False):
    if schema_editor.connection.vendor != "mysql":
        return

    with schema_editor.connection.cursor() as cursor:
        cursor.execute("SELECT DATABASE()")
        schema_name = cursor.fetchone()[0]
        for table, constraint, column, target, target_column, delete_rule in FOREIGN_KEYS:
            cursor.execute(
                "SELECT k.constraint_name, k.referenced_table_name, "
                "k.referenced_column_name, r.delete_rule "
                "FROM information_schema.key_column_usage k "
                "JOIN information_schema.referential_constraints r "
                "ON r.constraint_schema=k.constraint_schema "
                "AND r.constraint_name=k.constraint_name AND r.table_name=k.table_name "
                "WHERE k.constraint_schema=%s AND k.table_name=%s "
                "AND k.column_name=%s AND k.referenced_table_name IS NOT NULL",
                (schema_name, table, column),
            )
            existing = cursor.fetchall()
            if len(existing) != 1:
                raise RuntimeError(
                    f"Se esperaba una FK en {table}.{column}; se encontraron {len(existing)}."
                )
            name, referenced_table, referenced_column, current_delete = existing[0]
            expected_delete = "RESTRICT" if reverse else delete_rule
            desired_name = f"django_{constraint}" if reverse else constraint
            if (
                name == desired_name
                and referenced_table == target
                and referenced_column == target_column
                and current_delete.upper() in (expected_delete, "NO ACTION")
            ):
                continue
            if referenced_table != target or referenced_column != target_column:
                raise RuntimeError(
                    f"La FK {table}.{column} referencia "
                    f"{referenced_table}.{referenced_column}, no {target}.{target_column}."
                )
            cursor.execute(f"ALTER TABLE `{table}` DROP FOREIGN KEY `{name}`")
            cursor.execute(
                f"ALTER TABLE `{table}` ADD CONSTRAINT `{desired_name}` "
                f"FOREIGN KEY (`{column}`) REFERENCES `{target}` (`{target_column}`) "
                f"ON DELETE {expected_delete} ON UPDATE RESTRICT"
            )


def forwards(apps, schema_editor):
    _set_foreign_key_actions(schema_editor)


def backwards(apps, schema_editor):
    _set_foreign_key_actions(schema_editor, reverse=True)


class Migration(migrations.Migration):
    dependencies = [("adoptions", "0002_mysql_objects")]

    operations = [migrations.RunPython(forwards, backwards)]
