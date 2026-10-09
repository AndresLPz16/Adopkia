from django.db import migrations


class MySQLRunSQL(migrations.RunSQL):
    def database_forwards(self, app_label, schema_editor, from_state, to_state):
        if schema_editor.connection.vendor == "mysql":
            super().database_forwards(app_label, schema_editor, from_state, to_state)

    def database_backwards(self, app_label, schema_editor, from_state, to_state):
        if schema_editor.connection.vendor == "mysql":
            super().database_backwards(app_label, schema_editor, from_state, to_state)


class Migration(migrations.Migration):
    dependencies = [
        ("users", "0002_seed_roles"),
        ("shelters", "0001_initial"),
        ("pets", "0001_initial"),
        ("adoptions", "0001_initial"),
        ("medical", "0001_initial"),
        ("messaging", "0001_initial"),
        ("notifications", "0001_initial"),
    ]

    operations = [
        MySQLRunSQL(
            sql="CREATE FUNCTION fn_usuario_tiene_rol(p_id_usuario INT UNSIGNED, p_rol VARCHAR(30))\nRETURNS BOOLEAN\nREADS SQL DATA\nBEGIN\n  RETURN EXISTS (\n    SELECT 1\n    FROM usuario u\n    JOIN rol r ON r.id_rol = u.id_rol\n    WHERE u.id_usuario = p_id_usuario\n      AND r.nombre = p_rol\n  );\nEND",
            reverse_sql="DROP FUNCTION IF EXISTS fn_usuario_tiene_rol",
        ),
        MySQLRunSQL(
            sql="CREATE TRIGGER trg_refugio_admin_bi BEFORE INSERT ON refugio\nFOR EACH ROW\nBEGIN\n  IF NEW.id_admin_verificador IS NOT NULL\n     AND NOT fn_usuario_tiene_rol(NEW.id_admin_verificador, 'administrador') THEN\n    SIGNAL SQLSTATE '45000'\n      SET MESSAGE_TEXT = 'El verificador del refugio debe tener rol administrador';\n  END IF;\nEND",
            reverse_sql="DROP TRIGGER IF EXISTS trg_refugio_admin_bi",
        ),
        MySQLRunSQL(
            sql="CREATE TRIGGER trg_refugio_admin_bu BEFORE UPDATE ON refugio\nFOR EACH ROW\nBEGIN\n  IF NEW.id_admin_verificador IS NOT NULL\n     AND NOT fn_usuario_tiene_rol(NEW.id_admin_verificador, 'administrador') THEN\n    SIGNAL SQLSTATE '45000'\n      SET MESSAGE_TEXT = 'El verificador del refugio debe tener rol administrador';\n  END IF;\nEND",
            reverse_sql="DROP TRIGGER IF EXISTS trg_refugio_admin_bu",
        ),
        MySQLRunSQL(
            sql="CREATE TRIGGER trg_miembro_rol_bi BEFORE INSERT ON miembro_refugio\nFOR EACH ROW\nBEGIN\n  IF NOT fn_usuario_tiene_rol(NEW.id_usuario, 'refugio') THEN\n    SIGNAL SQLSTATE '45000'\n      SET MESSAGE_TEXT = 'El miembro del refugio debe tener rol refugio';\n  END IF;\nEND",
            reverse_sql="DROP TRIGGER IF EXISTS trg_miembro_rol_bi",
        ),
        MySQLRunSQL(
            sql="CREATE TRIGGER trg_miembro_rol_bu BEFORE UPDATE ON miembro_refugio\nFOR EACH ROW\nBEGIN\n  IF NOT fn_usuario_tiene_rol(NEW.id_usuario, 'refugio') THEN\n    SIGNAL SQLSTATE '45000'\n      SET MESSAGE_TEXT = 'El miembro del refugio debe tener rol refugio';\n  END IF;\nEND",
            reverse_sql="DROP TRIGGER IF EXISTS trg_miembro_rol_bu",
        ),
        MySQLRunSQL(
            sql="CREATE TRIGGER trg_veterinario_rol_bi BEFORE INSERT ON veterinario\nFOR EACH ROW\nBEGIN\n  IF NOT fn_usuario_tiene_rol(NEW.id_usuario, 'veterinario') THEN\n    SIGNAL SQLSTATE '45000'\n      SET MESSAGE_TEXT = 'El veterinario debe tener rol veterinario';\n  END IF;\nEND",
            reverse_sql="DROP TRIGGER IF EXISTS trg_veterinario_rol_bi",
        ),
        MySQLRunSQL(
            sql="CREATE TRIGGER trg_veterinario_rol_bu BEFORE UPDATE ON veterinario\nFOR EACH ROW\nBEGIN\n  IF NOT fn_usuario_tiene_rol(NEW.id_usuario, 'veterinario') THEN\n    SIGNAL SQLSTATE '45000'\n      SET MESSAGE_TEXT = 'El veterinario debe tener rol veterinario';\n  END IF;\nEND",
            reverse_sql="DROP TRIGGER IF EXISTS trg_veterinario_rol_bu",
        ),
        MySQLRunSQL(
            sql="CREATE FUNCTION fn_solicitud_aprobada(p_id_solicitud INT UNSIGNED)\nRETURNS BOOLEAN\nREADS SQL DATA\nBEGIN\n  RETURN EXISTS (\n    SELECT 1 FROM solicitud_adopcion\n    WHERE id_solicitud = p_id_solicitud AND estado = 'aprobada'\n  );\nEND",
            reverse_sql="DROP FUNCTION IF EXISTS fn_solicitud_aprobada",
        ),
        MySQLRunSQL(
            sql="CREATE TRIGGER trg_solicitud_rol_bi BEFORE INSERT ON solicitud_adopcion\nFOR EACH ROW\nBEGIN\n  IF NOT fn_usuario_tiene_rol(NEW.id_adoptante, 'adoptante') THEN\n    SIGNAL SQLSTATE '45000'\n      SET MESSAGE_TEXT = 'Quien solicita una adopción debe tener rol adoptante';\n  END IF;\nEND",
            reverse_sql="DROP TRIGGER IF EXISTS trg_solicitud_rol_bi",
        ),
        MySQLRunSQL(
            sql="CREATE TRIGGER trg_solicitud_rol_bu BEFORE UPDATE ON solicitud_adopcion\nFOR EACH ROW\nBEGIN\n  IF NEW.id_adoptante <> OLD.id_adoptante\n     AND NOT fn_usuario_tiene_rol(NEW.id_adoptante, 'adoptante') THEN\n    SIGNAL SQLSTATE '45000'\n      SET MESSAGE_TEXT = 'Quien solicita una adopción debe tener rol adoptante';\n  END IF;\n  IF OLD.estado = 'aprobada' AND NEW.estado <> 'aprobada'\n     AND EXISTS (SELECT 1 FROM adopcion WHERE id_solicitud = OLD.id_solicitud) THEN\n    SIGNAL SQLSTATE '45000'\n      SET MESSAGE_TEXT = 'La solicitud ya tiene una adopción y debe permanecer aprobada';\n  END IF;\nEND",
            reverse_sql="DROP TRIGGER IF EXISTS trg_solicitud_rol_bu",
        ),
        MySQLRunSQL(
            sql="CREATE TRIGGER trg_conversacion_rol_bi BEFORE INSERT ON conversacion\nFOR EACH ROW\nBEGIN\n  IF NOT fn_usuario_tiene_rol(NEW.id_adoptante, 'adoptante') THEN\n    SIGNAL SQLSTATE '45000'\n      SET MESSAGE_TEXT = 'El adoptante de la conversación debe tener rol adoptante';\n  END IF;\nEND",
            reverse_sql="DROP TRIGGER IF EXISTS trg_conversacion_rol_bi",
        ),
        MySQLRunSQL(
            sql="CREATE TRIGGER trg_conversacion_rol_bu BEFORE UPDATE ON conversacion\nFOR EACH ROW\nBEGIN\n  IF NEW.id_adoptante <> OLD.id_adoptante\n     AND NOT fn_usuario_tiene_rol(NEW.id_adoptante, 'adoptante') THEN\n    SIGNAL SQLSTATE '45000'\n      SET MESSAGE_TEXT = 'El adoptante de la conversación debe tener rol adoptante';\n  END IF;\nEND",
            reverse_sql="DROP TRIGGER IF EXISTS trg_conversacion_rol_bu",
        ),
        MySQLRunSQL(
            sql="CREATE TRIGGER trg_adopcion_bi BEFORE INSERT ON adopcion\nFOR EACH ROW\nBEGIN\n  IF NOT fn_solicitud_aprobada(NEW.id_solicitud) THEN\n    SIGNAL SQLSTATE '45000'\n      SET MESSAGE_TEXT = 'Solo se puede crear una adopción desde una solicitud aprobada';\n  END IF;\nEND",
            reverse_sql="DROP TRIGGER IF EXISTS trg_adopcion_bi",
        ),
        MySQLRunSQL(
            sql="CREATE TRIGGER trg_adopcion_bu BEFORE UPDATE ON adopcion\nFOR EACH ROW\nBEGIN\n  IF NEW.id_solicitud <> OLD.id_solicitud THEN\n    SIGNAL SQLSTATE '45000'\n      SET MESSAGE_TEXT = 'No se puede cambiar la solicitud de una adopción existente';\n  END IF;\nEND",
            reverse_sql="DROP TRIGGER IF EXISTS trg_adopcion_bu",
        ),
        MySQLRunSQL(
            sql="CREATE TRIGGER trg_usuario_rol_bu BEFORE UPDATE ON usuario\nFOR EACH ROW\nBEGIN\n  DECLARE v_nuevo VARCHAR(30);\n  IF NEW.id_rol <> OLD.id_rol THEN\n    SELECT nombre INTO v_nuevo FROM rol WHERE id_rol = NEW.id_rol;\n    IF v_nuevo <> 'refugio'\n       AND EXISTS (SELECT 1 FROM miembro_refugio WHERE id_usuario = OLD.id_usuario) THEN\n      SIGNAL SQLSTATE '45000'\n        SET MESSAGE_TEXT = 'No se puede cambiar el rol: el usuario es miembro de un refugio';\n    END IF;\n    IF v_nuevo <> 'veterinario'\n       AND EXISTS (SELECT 1 FROM veterinario WHERE id_usuario = OLD.id_usuario) THEN\n      SIGNAL SQLSTATE '45000'\n        SET MESSAGE_TEXT = 'No se puede cambiar el rol: el usuario tiene perfil de veterinario';\n    END IF;\n    IF v_nuevo <> 'administrador'\n       AND EXISTS (SELECT 1 FROM refugio WHERE id_admin_verificador = OLD.id_usuario) THEN\n      SIGNAL SQLSTATE '45000'\n        SET MESSAGE_TEXT = 'No se puede cambiar el rol: el usuario verificó refugios';\n    END IF;\n    IF v_nuevo <> 'adoptante'\n       AND (EXISTS (SELECT 1 FROM solicitud_adopcion WHERE id_adoptante = OLD.id_usuario)\n         OR EXISTS (SELECT 1 FROM conversacion WHERE id_adoptante = OLD.id_usuario)) THEN\n      SIGNAL SQLSTATE '45000'\n        SET MESSAGE_TEXT = 'No se puede cambiar el rol: el usuario tiene solicitudes o conversaciones como adoptante';\n    END IF;\n  END IF;\nEND",
            reverse_sql="DROP TRIGGER IF EXISTS trg_usuario_rol_bu",
        ),
        MySQLRunSQL(
            sql="CREATE OR REPLACE VIEW vista_mascotas_disponibles AS\nSELECT m.id_mascota,\n       m.nombre,\n       e.nombre AS especie,\n       r.nombre AS raza,\n       m.tamano,\n       TIMESTAMPDIFF(YEAR, m.fecha_nacimiento_aprox, CURDATE()) AS edad_anios,\n       m.temperamento,\n       rf.nombre AS refugio,\n       rf.ciudad,\n       (SELECT f.url FROM foto_mascota f\n         WHERE f.id_mascota = m.id_mascota\n         ORDER BY f.es_principal DESC, f.id_foto\n         LIMIT 1) AS foto_principal\nFROM mascota m\nJOIN raza    r  ON r.id_raza = m.id_raza\nJOIN especie e  ON e.id_especie = r.id_especie\nJOIN refugio rf ON rf.id_refugio = m.id_refugio\nWHERE m.estado = 'disponible'\n  AND rf.estado_verificacion = 'verificado';",
            reverse_sql="DROP VIEW IF EXISTS vista_mascotas_disponibles",
        ),
        MySQLRunSQL(
            sql="CREATE OR REPLACE VIEW vista_tasa_devolucion AS\nSELECT rf.id_refugio,\n       rf.nombre AS refugio,\n       COUNT(a.id_adopcion) AS total_adopciones,\n       SUM(a.estado = 'devuelta') AS devueltas,\n       ROUND(100 * SUM(a.estado = 'devuelta') / COUNT(a.id_adopcion), 2) AS tasa_devolucion_pct\nFROM adopcion a\nJOIN solicitud_adopcion s ON s.id_solicitud = a.id_solicitud\nJOIN mascota m            ON m.id_mascota   = s.id_mascota\nJOIN refugio rf           ON rf.id_refugio  = m.id_refugio\nGROUP BY rf.id_refugio, rf.nombre;",
            reverse_sql="DROP VIEW IF EXISTS vista_tasa_devolucion",
        ),
    ]
