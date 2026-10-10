-- =====================================================================
--  ADOPKIA · Base de datos (versión 3: integridad reforzada + datos base)
--  Motor: MySQL 8.0.16+  (MySQL Workbench)
--  Ejecutar completo: Ctrl+Shift+Enter  (o el rayo "Execute all")
--
--  ATENCIÓN: este script ELIMINA y vuelve a crear el esquema `adopkia`.
--
--  Correcciones aplicadas según la retroalimentación del profesor:
--   1. Relaciones correctas por FK (Notificacion -> Usuario, sin líneas dobles).
--   2. Nuevas: CONVERSACION y MENSAJE.
--   3. Nuevas: VETERINARIO, VACUNA y RECORDATORIO (fecha_programada, estado);
--      Historial_Medico ahora tiene id_veterinario.
--   4. Grupo repetitivo eliminado (1FN): PREGUNTA_FORMULARIO + RESPUESTA.
--   5. Nueva: ADOPCION (fecha, estado, fecha/motivo de devolución);
--      SEGUIMIENTO depende de ADOPCION.
--   6. Mascota: catálogos ESPECIE/RAZA, fecha_nacimiento_aprox, salud,
--      temperamento, estado (en vez de booleano) y FOTO_MASCOTA.
--   7. Refugio: fecha_verificacion + administrador verificador.
--      Un refugio tiene VARIOS usuarios (MIEMBRO_REFUGIO); un usuario
--      pertenece a un solo refugio.
--   8. Tipos de datos definidos y UNIQUE(correo).
--
--  Versión 2:
--   9. Nueva: ROL (catálogo). USUARIO.id_rol reemplaza al ENUM `rol`.
--      Triggers que garantizan la coherencia de roles:
--        - el verificador de un refugio debe ser 'administrador'
--        - un miembro de refugio debe tener rol 'refugio'
--        - un veterinario debe tener rol 'veterinario'
--
--  Cambios de esta versión (v3):
--  10. Roles también al ACTUALIZAR: no se puede cambiar el rol de un usuario
--      que ya cumple una función que lo exige (miembro, veterinario,
--      verificador, adoptante con solicitudes/conversaciones). Además,
--      solicitud_adopcion.id_adoptante y conversacion.id_adoptante deben
--      ser usuarios con rol 'adoptante'.
--  11. Una ADOPCION solo puede nacer de una solicitud 'aprobada', y una
--      solicitud con adopción no puede dejar de estar aprobada.
--  12. Sin solicitudes pendientes duplicadas: un adoptante no puede tener
--      dos solicitudes 'pendiente' para la misma mascota.
--  13. Mestizos / raza desconocida: cada especie tiene la raza 'Mestizo'
--      (id_raza sigue siendo obligatorio para poder derivar la especie).
--  14. Datos base: especies, razas, vacunas y preguntas del formulario.
-- =====================================================================

-- DROP DATABASE IF EXISTS adopkia;
-- Advertencia: borrar esta base elimina todos sus datos. Ejecuta esta sentencia
-- manualmente solo si deseas reinstalar desde cero.
CREATE DATABASE IF NOT EXISTS adopkia
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
USE adopkia;

-- ---------------------------------------------------------------------
-- 0. ROL  (catálogo)
-- ---------------------------------------------------------------------
CREATE TABLE rol (
  id_rol      TINYINT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre      VARCHAR(30)      NOT NULL,
  descripcion VARCHAR(150)     NULL,
  PRIMARY KEY (id_rol),
  CONSTRAINT uq_rol_nombre UNIQUE (nombre)
) ENGINE=InnoDB;

INSERT INTO rol (nombre, descripcion) VALUES
  ('adoptante',     'Persona que solicita adoptar una mascota'),
  ('refugio',       'Integrante de un refugio o protectora'),
  ('administrador', 'Verifica refugios y supervisa la plataforma'),
  ('veterinario',   'Veterinario aliado que registra atenciones médicas');

-- ---------------------------------------------------------------------
-- 1. USUARIO
-- ---------------------------------------------------------------------
CREATE TABLE usuario (
  id_usuario      INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  id_rol          TINYINT UNSIGNED NOT NULL,
  nombre          VARCHAR(100)     NOT NULL,
  correo          VARCHAR(150)     NOT NULL,
  contrasena_hash VARCHAR(255)     NOT NULL COMMENT 'Hash (bcrypt/argon2), nunca texto plano',
  telefono        VARCHAR(20)      NULL,
  activo          BOOLEAN          NOT NULL DEFAULT TRUE,
  fecha_registro  DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_usuario),
  CONSTRAINT uq_usuario_correo UNIQUE (correo),
  CONSTRAINT fk_usuario_rol FOREIGN KEY (id_rol)
    REFERENCES rol (id_rol)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 2. REFUGIO  (verificado por un usuario administrador)
-- ---------------------------------------------------------------------
CREATE TABLE refugio (
  id_refugio            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre                VARCHAR(120) NOT NULL,
  direccion             VARCHAR(200) NOT NULL,
  ciudad                VARCHAR(80)  NOT NULL,
  telefono_contacto     VARCHAR(20)  NULL,
  correo_contacto       VARCHAR(150) NULL,
  estado_verificacion   ENUM('pendiente','verificado','rechazado') NOT NULL DEFAULT 'pendiente',
  fecha_verificacion    DATETIME     NULL,
  id_admin_verificador  INT UNSIGNED NULL,
  fecha_registro        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_refugio),
  CONSTRAINT uq_refugio_nombre_ciudad UNIQUE (nombre, ciudad),
  CONSTRAINT fk_refugio_admin FOREIGN KEY (id_admin_verificador)
    REFERENCES usuario (id_usuario),
  -- Si está verificado debe constar cuándo y quién lo validó
  CONSTRAINT ck_refugio_verificacion CHECK (
    estado_verificacion <> 'verificado'
    OR (fecha_verificacion IS NOT NULL AND id_admin_verificador IS NOT NULL)
  )
) ENGINE=InnoDB;
CREATE INDEX idx_refugio_ciudad ON refugio (ciudad);

-- ---------------------------------------------------------------------
-- 3. MIEMBRO_REFUGIO  (1 refugio : N usuarios;  1 usuario : 1 refugio)
-- ---------------------------------------------------------------------
CREATE TABLE miembro_refugio (
  id_miembro   INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_refugio   INT UNSIGNED NOT NULL,
  id_usuario   INT UNSIGNED NOT NULL,
  cargo        ENUM('responsable','colaborador') NOT NULL DEFAULT 'colaborador',
  PRIMARY KEY (id_miembro),
  CONSTRAINT uq_miembro_usuario UNIQUE (id_usuario),
  CONSTRAINT fk_miembro_refugio FOREIGN KEY (id_refugio)
    REFERENCES refugio (id_refugio) ON DELETE CASCADE,
  CONSTRAINT fk_miembro_usuario FOREIGN KEY (id_usuario)
    REFERENCES usuario (id_usuario) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 4. VETERINARIO  (actor "Veterinario aliado": es un usuario con datos propios)
-- ---------------------------------------------------------------------
CREATE TABLE veterinario (
  id_veterinario     INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_usuario         INT UNSIGNED NOT NULL,
  tarjeta_profesional VARCHAR(30) NOT NULL,
  clinica            VARCHAR(120) NULL,
  especialidad       VARCHAR(80)  NULL,
  PRIMARY KEY (id_veterinario),
  CONSTRAINT uq_veterinario_usuario UNIQUE (id_usuario),
  CONSTRAINT uq_veterinario_tarjeta UNIQUE (tarjeta_profesional),
  CONSTRAINT fk_veterinario_usuario FOREIGN KEY (id_usuario)
    REFERENCES usuario (id_usuario) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 5. CATÁLOGOS: ESPECIE y RAZA
-- ---------------------------------------------------------------------
CREATE TABLE especie (
  id_especie INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre     VARCHAR(50)  NOT NULL,
  PRIMARY KEY (id_especie),
  CONSTRAINT uq_especie_nombre UNIQUE (nombre)
) ENGINE=InnoDB;

CREATE TABLE raza (
  id_raza    INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_especie INT UNSIGNED NOT NULL,
  nombre     VARCHAR(80)  NOT NULL,
  PRIMARY KEY (id_raza),
  CONSTRAINT uq_raza_especie_nombre UNIQUE (id_especie, nombre),
  CONSTRAINT fk_raza_especie FOREIGN KEY (id_especie)
    REFERENCES especie (id_especie)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 6. MASCOTA  (la especie se obtiene por raza -> especie;
--    si la raza es desconocida/mestiza se usa la raza 'Mestizo' de la especie)
-- ---------------------------------------------------------------------
CREATE TABLE mascota (
  id_mascota               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_refugio               INT UNSIGNED NOT NULL,
  id_raza                  INT UNSIGNED NOT NULL,
  nombre                   VARCHAR(80)  NOT NULL,
  fecha_nacimiento_aprox   DATE         NULL,
  tamano                   ENUM('pequeno','mediano','grande') NOT NULL,
  salud                    TEXT         NULL COMMENT 'Estado de salud general (ficha)',
  temperamento             VARCHAR(150) NULL,
  estado                   ENUM('disponible','en_proceso','adoptada','devuelta')
                           NOT NULL DEFAULT 'disponible',
  fecha_publicacion        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_mascota),
  CONSTRAINT fk_mascota_refugio FOREIGN KEY (id_refugio)
    REFERENCES refugio (id_refugio),
  CONSTRAINT fk_mascota_raza FOREIGN KEY (id_raza)
    REFERENCES raza (id_raza)
) ENGINE=InnoDB;
CREATE INDEX idx_mascota_estado ON mascota (estado);
CREATE INDEX idx_mascota_tamano ON mascota (tamano);

-- ---------------------------------------------------------------------
-- 7. FOTO_MASCOTA
-- ---------------------------------------------------------------------
CREATE TABLE foto_mascota (
  id_foto       INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_mascota    INT UNSIGNED NOT NULL,
  url           VARCHAR(500) NOT NULL,
  es_principal  BOOLEAN      NOT NULL DEFAULT FALSE,
  fecha_subida  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_foto),
  CONSTRAINT fk_foto_mascota FOREIGN KEY (id_mascota)
    REFERENCES mascota (id_mascota) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 8. FORMULARIO DE EVALUACIÓN: PREGUNTA_FORMULARIO + (más abajo) RESPUESTA
-- ---------------------------------------------------------------------
CREATE TABLE pregunta_formulario (
  id_pregunta    INT UNSIGNED NOT NULL AUTO_INCREMENT,
  enunciado      VARCHAR(300) NOT NULL,
  tipo_respuesta ENUM('texto','numero','si_no','opcion') NOT NULL DEFAULT 'texto',
  obligatoria    BOOLEAN      NOT NULL DEFAULT TRUE,
  orden          SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  activa         BOOLEAN      NOT NULL DEFAULT TRUE,
  PRIMARY KEY (id_pregunta)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 9. SOLICITUD_ADOPCION  (sin campo repetitivo de respuestas)
-- ---------------------------------------------------------------------
CREATE TABLE solicitud_adopcion (
  id_solicitud         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_adoptante         INT UNSIGNED NOT NULL,
  id_mascota           INT UNSIGNED NOT NULL,
  fecha_solicitud      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  estado               ENUM('pendiente','aprobada','rechazada','cancelada')
                       NOT NULL DEFAULT 'pendiente',
  fecha_respuesta      DATETIME     NULL,
  observaciones_refugio VARCHAR(500) NULL,
  -- 1 solo cuando la solicitud está pendiente; NULL en los demás estados.
  -- Con el UNIQUE de abajo impide solicitudes pendientes duplicadas.
  pendiente_unica       TINYINT GENERATED ALWAYS AS (CASE WHEN estado = 'pendiente' THEN 1 ELSE NULL END) STORED,
  PRIMARY KEY (id_solicitud),
  CONSTRAINT uq_solicitud_pendiente UNIQUE (id_adoptante, id_mascota, pendiente_unica),
  CONSTRAINT fk_solicitud_adoptante FOREIGN KEY (id_adoptante)
    REFERENCES usuario (id_usuario),
  CONSTRAINT fk_solicitud_mascota FOREIGN KEY (id_mascota)
    REFERENCES mascota (id_mascota)
) ENGINE=InnoDB;
CREATE INDEX idx_solicitud_estado ON solicitud_adopcion (estado);

-- ---------------------------------------------------------------------
-- 10. RESPUESTA  (id_solicitud, id_pregunta, valor)  -> cumple 1FN
-- ---------------------------------------------------------------------
CREATE TABLE respuesta (
  id_solicitud INT UNSIGNED NOT NULL,
  id_pregunta  INT UNSIGNED NOT NULL,
  valor        TEXT         NOT NULL,
  PRIMARY KEY (id_solicitud, id_pregunta),
  CONSTRAINT fk_respuesta_solicitud FOREIGN KEY (id_solicitud)
    REFERENCES solicitud_adopcion (id_solicitud) ON DELETE CASCADE,
  CONSTRAINT fk_respuesta_pregunta FOREIGN KEY (id_pregunta)
    REFERENCES pregunta_formulario (id_pregunta)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 11. ADOPCION  (nace de una solicitud aprobada; permite la tasa de devolución)
-- ---------------------------------------------------------------------
CREATE TABLE adopcion (
  id_adopcion       INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_solicitud      INT UNSIGNED NOT NULL,
  fecha_adopcion    DATE         NOT NULL,
  estado            ENUM('activa','devuelta','finalizada') NOT NULL DEFAULT 'activa',
  fecha_devolucion  DATE         NULL,
  motivo_devolucion VARCHAR(500) NULL,
  PRIMARY KEY (id_adopcion),
  CONSTRAINT uq_adopcion_solicitud UNIQUE (id_solicitud),   -- 1 solicitud -> 0..1 adopción
  CONSTRAINT fk_adopcion_solicitud FOREIGN KEY (id_solicitud)
    REFERENCES solicitud_adopcion (id_solicitud),
  -- Coherencia: los datos de devolución existen solo si el estado es 'devuelta'
  CONSTRAINT ck_adopcion_devolucion CHECK (
    (estado = 'devuelta'
       AND fecha_devolucion IS NOT NULL
       AND motivo_devolucion IS NOT NULL
       AND fecha_devolucion >= fecha_adopcion)
    OR
    (estado <> 'devuelta'
       AND fecha_devolucion IS NULL
       AND motivo_devolucion IS NULL)
  )
) ENGINE=InnoDB;
CREATE INDEX idx_adopcion_estado ON adopcion (estado);

-- ---------------------------------------------------------------------
-- 12. SEGUIMIENTO  (check-ins; ahora depende de ADOPCION)
-- ---------------------------------------------------------------------
CREATE TABLE seguimiento (
  id_seguimiento  INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_adopcion     INT UNSIGNED NOT NULL,
  id_registrado_por INT UNSIGNED NULL,
  fecha           DATE         NOT NULL,
  bienestar       ENUM('excelente','bueno','regular','preocupante') NOT NULL DEFAULT 'bueno',
  observaciones   TEXT         NULL,
  PRIMARY KEY (id_seguimiento),
  CONSTRAINT fk_seguimiento_adopcion FOREIGN KEY (id_adopcion)
    REFERENCES adopcion (id_adopcion) ON DELETE CASCADE,
  CONSTRAINT fk_seguimiento_usuario FOREIGN KEY (id_registrado_por)
    REFERENCES usuario (id_usuario) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 13. VACUNA  (catálogo)
-- ---------------------------------------------------------------------
CREATE TABLE vacuna (
  id_vacuna          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_especie         INT UNSIGNED NOT NULL,
  nombre             VARCHAR(100) NOT NULL,
  descripcion        VARCHAR(255) NULL,
  intervalo_refuerzo_dias SMALLINT UNSIGNED NULL COMMENT 'Días hasta el próximo refuerzo',
  PRIMARY KEY (id_vacuna),
  CONSTRAINT uq_vacuna_especie_nombre UNIQUE (id_especie, nombre),
  CONSTRAINT fk_vacuna_especie FOREIGN KEY (id_especie)
    REFERENCES especie (id_especie)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 14. HISTORIAL_MEDICO  (ahora con veterinario y vacuna opcional)
-- ---------------------------------------------------------------------
CREATE TABLE historial_medico (
  id_historial   INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_mascota     INT UNSIGNED NOT NULL,
  id_veterinario INT UNSIGNED NULL COMMENT 'NULL si lo registra el refugio sin veterinario aliado',
  id_vacuna      INT UNSIGNED NULL COMMENT 'Solo cuando tipo = vacunacion',
  fecha          DATE         NOT NULL,
  tipo           ENUM('consulta','vacunacion','desparasitacion','cirugia','control','otro') NOT NULL,
  descripcion    TEXT         NULL,
  PRIMARY KEY (id_historial),
  CONSTRAINT fk_historial_mascota FOREIGN KEY (id_mascota)
    REFERENCES mascota (id_mascota) ON DELETE CASCADE,
  CONSTRAINT fk_historial_veterinario FOREIGN KEY (id_veterinario)
    REFERENCES veterinario (id_veterinario) ON DELETE SET NULL,
  CONSTRAINT fk_historial_vacuna FOREIGN KEY (id_vacuna)
    REFERENCES vacuna (id_vacuna),
  CONSTRAINT ck_historial_vacuna CHECK (id_vacuna IS NULL OR tipo = 'vacunacion')
) ENGINE=InnoDB;
CREATE INDEX idx_historial_fecha ON historial_medico (fecha);

-- ---------------------------------------------------------------------
-- 15. RECORDATORIO  (propósito central: vacunas, controles y check-ins)
-- ---------------------------------------------------------------------
CREATE TABLE recordatorio (
  id_recordatorio    INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_adopcion        INT UNSIGNED NOT NULL,
  id_vacuna          INT UNSIGNED NULL COMMENT 'Solo cuando tipo = vacuna',
  id_historial       INT UNSIGNED NULL COMMENT 'Atención que cumplió el recordatorio',
  tipo               ENUM('vacuna','control_veterinario','checkin') NOT NULL,
  fecha_programada   DATE         NOT NULL,
  estado             ENUM('pendiente','notificado','cumplido','vencido','cancelado')
                     NOT NULL DEFAULT 'pendiente',
  PRIMARY KEY (id_recordatorio),
  CONSTRAINT fk_recordatorio_adopcion FOREIGN KEY (id_adopcion)
    REFERENCES adopcion (id_adopcion) ON DELETE CASCADE,
  CONSTRAINT fk_recordatorio_vacuna FOREIGN KEY (id_vacuna)
    REFERENCES vacuna (id_vacuna),
  CONSTRAINT fk_recordatorio_historial FOREIGN KEY (id_historial)
    REFERENCES historial_medico (id_historial) ON DELETE SET NULL,
  CONSTRAINT ck_recordatorio_vacuna CHECK (id_vacuna IS NULL OR tipo = 'vacuna')
) ENGINE=InnoDB;
CREATE INDEX idx_recordatorio_fecha_estado ON recordatorio (fecha_programada, estado);

-- ---------------------------------------------------------------------
-- 16. NOTIFICACION  (pertenece a USUARIO; origen opcional)
-- ---------------------------------------------------------------------
CREATE TABLE notificacion (
  id_notificacion INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_usuario      INT UNSIGNED NOT NULL,
  id_solicitud    INT UNSIGNED NULL,
  id_recordatorio INT UNSIGNED NULL,
  tipo            ENUM('nueva_solicitud','aprobacion','rechazo','recordatorio','mensaje','sistema')
                  NOT NULL,
  mensaje         VARCHAR(500) NOT NULL,
  fecha_envio     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  leida           BOOLEAN      NOT NULL DEFAULT FALSE,
  PRIMARY KEY (id_notificacion),
  CONSTRAINT fk_notif_usuario FOREIGN KEY (id_usuario)
    REFERENCES usuario (id_usuario) ON DELETE CASCADE,
  CONSTRAINT fk_notif_solicitud FOREIGN KEY (id_solicitud)
    REFERENCES solicitud_adopcion (id_solicitud) ON DELETE SET NULL,
  CONSTRAINT fk_notif_recordatorio FOREIGN KEY (id_recordatorio)
    REFERENCES recordatorio (id_recordatorio) ON DELETE SET NULL
) ENGINE=InnoDB;
CREATE INDEX idx_notif_usuario_leida ON notificacion (id_usuario, leida);

-- ---------------------------------------------------------------------
-- 17. CONVERSACION  (adoptante <-> refugio, opcionalmente sobre una mascota)
-- ---------------------------------------------------------------------
CREATE TABLE conversacion (
  id_conversacion INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_adoptante    INT UNSIGNED NOT NULL,
  id_refugio      INT UNSIGNED NOT NULL,
  id_mascota      INT UNSIGNED NULL,
  fecha_inicio    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_conversacion),
  CONSTRAINT fk_conv_adoptante FOREIGN KEY (id_adoptante)
    REFERENCES usuario (id_usuario) ON DELETE CASCADE,
  CONSTRAINT fk_conv_refugio FOREIGN KEY (id_refugio)
    REFERENCES refugio (id_refugio) ON DELETE CASCADE,
  CONSTRAINT fk_conv_mascota FOREIGN KEY (id_mascota)
    REFERENCES mascota (id_mascota) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 18. MENSAJE
-- ---------------------------------------------------------------------
CREATE TABLE mensaje (
  id_mensaje      INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_conversacion INT UNSIGNED NOT NULL,
  id_remitente    INT UNSIGNED NOT NULL,
  contenido       TEXT         NOT NULL,
  fecha_envio     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  leido           BOOLEAN      NOT NULL DEFAULT FALSE,
  PRIMARY KEY (id_mensaje),
  CONSTRAINT fk_mensaje_conversacion FOREIGN KEY (id_conversacion)
    REFERENCES conversacion (id_conversacion) ON DELETE CASCADE,
  CONSTRAINT fk_mensaje_remitente FOREIGN KEY (id_remitente)
    REFERENCES usuario (id_usuario)
) ENGINE=InnoDB;
CREATE INDEX idx_mensaje_conv_fecha ON mensaje (id_conversacion, fecha_envio);

-- =====================================================================
--  COHERENCIA DE ROLES  (función + triggers)
--  Una FK o un CHECK no pueden consultar otra tabla; por eso se usan
--  triggers para validar que el usuario tenga el rol que la tabla exige.
-- =====================================================================
DELIMITER $$

CREATE FUNCTION fn_usuario_tiene_rol(p_id_usuario INT UNSIGNED, p_rol VARCHAR(30))
RETURNS BOOLEAN
READS SQL DATA
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM usuario u
    JOIN rol r ON r.id_rol = u.id_rol
    WHERE u.id_usuario = p_id_usuario
      AND r.nombre = p_rol
  );
END$$

-- El verificador de un refugio debe ser administrador
CREATE TRIGGER trg_refugio_admin_bi BEFORE INSERT ON refugio
FOR EACH ROW
BEGIN
  IF NEW.id_admin_verificador IS NOT NULL
     AND NOT fn_usuario_tiene_rol(NEW.id_admin_verificador, 'administrador') THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'El verificador del refugio debe tener rol administrador';
  END IF;
END$$

CREATE TRIGGER trg_refugio_admin_bu BEFORE UPDATE ON refugio
FOR EACH ROW
BEGIN
  IF NEW.id_admin_verificador IS NOT NULL
     AND NOT fn_usuario_tiene_rol(NEW.id_admin_verificador, 'administrador') THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'El verificador del refugio debe tener rol administrador';
  END IF;
END$$

-- Un miembro de refugio debe tener rol 'refugio'
CREATE TRIGGER trg_miembro_rol_bi BEFORE INSERT ON miembro_refugio
FOR EACH ROW
BEGIN
  IF NOT fn_usuario_tiene_rol(NEW.id_usuario, 'refugio') THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'El miembro del refugio debe tener rol refugio';
  END IF;
END$$

CREATE TRIGGER trg_miembro_rol_bu BEFORE UPDATE ON miembro_refugio
FOR EACH ROW
BEGIN
  IF NOT fn_usuario_tiene_rol(NEW.id_usuario, 'refugio') THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'El miembro del refugio debe tener rol refugio';
  END IF;
END$$

-- Un veterinario debe tener rol 'veterinario'
CREATE TRIGGER trg_veterinario_rol_bi BEFORE INSERT ON veterinario
FOR EACH ROW
BEGIN
  IF NOT fn_usuario_tiene_rol(NEW.id_usuario, 'veterinario') THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'El veterinario debe tener rol veterinario';
  END IF;
END$$

CREATE TRIGGER trg_veterinario_rol_bu BEFORE UPDATE ON veterinario
FOR EACH ROW
BEGIN
  IF NOT fn_usuario_tiene_rol(NEW.id_usuario, 'veterinario') THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'El veterinario debe tener rol veterinario';
  END IF;
END$$

-- ---------------------------------------------------------------------
--  v3 · Funciones y triggers adicionales
-- ---------------------------------------------------------------------

CREATE FUNCTION fn_solicitud_aprobada(p_id_solicitud INT UNSIGNED)
RETURNS BOOLEAN
READS SQL DATA
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM solicitud_adopcion
    WHERE id_solicitud = p_id_solicitud AND estado = 'aprobada'
  );
END$$

-- Quien solicita una adopción debe tener rol 'adoptante'
CREATE TRIGGER trg_solicitud_rol_bi BEFORE INSERT ON solicitud_adopcion
FOR EACH ROW
BEGIN
  IF NOT fn_usuario_tiene_rol(NEW.id_adoptante, 'adoptante') THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Quien solicita una adopción debe tener rol adoptante';
  END IF;
END$$

CREATE TRIGGER trg_solicitud_rol_bu BEFORE UPDATE ON solicitud_adopcion
FOR EACH ROW
BEGIN
  IF NEW.id_adoptante <> OLD.id_adoptante
     AND NOT fn_usuario_tiene_rol(NEW.id_adoptante, 'adoptante') THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Quien solicita una adopción debe tener rol adoptante';
  END IF;
  -- Una solicitud con adopción registrada debe seguir aprobada
  IF OLD.estado = 'aprobada' AND NEW.estado <> 'aprobada'
     AND EXISTS (SELECT 1 FROM adopcion WHERE id_solicitud = OLD.id_solicitud) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'La solicitud ya tiene una adopción y debe permanecer aprobada';
  END IF;
END$$

-- El adoptante de una conversación debe tener rol 'adoptante'
CREATE TRIGGER trg_conversacion_rol_bi BEFORE INSERT ON conversacion
FOR EACH ROW
BEGIN
  IF NOT fn_usuario_tiene_rol(NEW.id_adoptante, 'adoptante') THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'El adoptante de la conversación debe tener rol adoptante';
  END IF;
END$$

CREATE TRIGGER trg_conversacion_rol_bu BEFORE UPDATE ON conversacion
FOR EACH ROW
BEGIN
  IF NEW.id_adoptante <> OLD.id_adoptante
     AND NOT fn_usuario_tiene_rol(NEW.id_adoptante, 'adoptante') THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'El adoptante de la conversación debe tener rol adoptante';
  END IF;
END$$

-- Una adopción solo puede nacer de una solicitud aprobada
CREATE TRIGGER trg_adopcion_bi BEFORE INSERT ON adopcion
FOR EACH ROW
BEGIN
  IF NOT fn_solicitud_aprobada(NEW.id_solicitud) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Solo se puede crear una adopción desde una solicitud aprobada';
  END IF;
END$$

CREATE TRIGGER trg_adopcion_bu BEFORE UPDATE ON adopcion
FOR EACH ROW
BEGIN
  IF NEW.id_solicitud <> OLD.id_solicitud THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'No se puede cambiar la solicitud de una adopción existente';
  END IF;
END$$

-- Cambio de rol: no puede dejar inconsistente lo que el usuario ya hace
CREATE TRIGGER trg_usuario_rol_bu BEFORE UPDATE ON usuario
FOR EACH ROW
BEGIN
  DECLARE v_nuevo VARCHAR(30);
  IF NEW.id_rol <> OLD.id_rol THEN
    SELECT nombre INTO v_nuevo FROM rol WHERE id_rol = NEW.id_rol;
    IF v_nuevo <> 'refugio'
       AND EXISTS (SELECT 1 FROM miembro_refugio WHERE id_usuario = OLD.id_usuario) THEN
      SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'No se puede cambiar el rol: el usuario es miembro de un refugio';
    END IF;
    IF v_nuevo <> 'veterinario'
       AND EXISTS (SELECT 1 FROM veterinario WHERE id_usuario = OLD.id_usuario) THEN
      SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'No se puede cambiar el rol: el usuario tiene perfil de veterinario';
    END IF;
    IF v_nuevo <> 'administrador'
       AND EXISTS (SELECT 1 FROM refugio WHERE id_admin_verificador = OLD.id_usuario) THEN
      SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'No se puede cambiar el rol: el usuario verificó refugios';
    END IF;
    IF v_nuevo <> 'adoptante'
       AND (EXISTS (SELECT 1 FROM solicitud_adopcion WHERE id_adoptante = OLD.id_usuario)
         OR EXISTS (SELECT 1 FROM conversacion WHERE id_adoptante = OLD.id_usuario)) THEN
      SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'No se puede cambiar el rol: el usuario tiene solicitudes o conversaciones como adoptante';
    END IF;
  END IF;
END$$

DELIMITER ;

-- =====================================================================
--  VISTAS ÚTILES
-- =====================================================================

-- Catálogo público: la edad se calcula, no se almacena (no se desactualiza)
CREATE OR REPLACE VIEW vista_mascotas_disponibles AS
SELECT m.id_mascota,
       m.nombre,
       e.nombre AS especie,
       r.nombre AS raza,
       m.tamano,
       TIMESTAMPDIFF(YEAR, m.fecha_nacimiento_aprox, CURDATE()) AS edad_anios,
       m.temperamento,
       rf.nombre AS refugio,
       rf.ciudad,
       (SELECT f.url FROM foto_mascota f
         WHERE f.id_mascota = m.id_mascota
         ORDER BY f.es_principal DESC, f.id_foto
         LIMIT 1) AS foto_principal
FROM mascota m
JOIN raza    r  ON r.id_raza = m.id_raza
JOIN especie e  ON e.id_especie = r.id_especie
JOIN refugio rf ON rf.id_refugio = m.id_refugio
WHERE m.estado = 'disponible'
  AND rf.estado_verificacion = 'verificado';

-- Tasa de devolución por refugio
CREATE OR REPLACE VIEW vista_tasa_devolucion AS
SELECT rf.id_refugio,
       rf.nombre AS refugio,
       COUNT(a.id_adopcion) AS total_adopciones,
       SUM(a.estado = 'devuelta') AS devueltas,
       ROUND(100 * SUM(a.estado = 'devuelta') / COUNT(a.id_adopcion), 2) AS tasa_devolucion_pct
FROM adopcion a
JOIN solicitud_adopcion s ON s.id_solicitud = a.id_solicitud
JOIN mascota m            ON m.id_mascota   = s.id_mascota
JOIN refugio rf           ON rf.id_refugio  = m.id_refugio
GROUP BY rf.id_refugio, rf.nombre;

-- =====================================================================
--  DATOS BASE (catálogos)
--  Los intervalos de refuerzo de las vacunas son valores de referencia
--  (esquema anual habitual); deben validarse con un veterinario.
-- =====================================================================

INSERT INTO especie (nombre) VALUES ('Perro'), ('Gato');

-- 'Mestizo' = raza desconocida o mezcla (una por especie)
INSERT INTO raza (id_especie, nombre)
SELECT e.id_especie, r.nombre
FROM especie e
JOIN (
  SELECT 'Perro' AS especie, 'Mestizo' AS nombre UNION ALL
  SELECT 'Perro', 'Labrador Retriever' UNION ALL
  SELECT 'Perro', 'Golden Retriever'   UNION ALL
  SELECT 'Perro', 'Pastor Alemán'      UNION ALL
  SELECT 'Perro', 'Pitbull'            UNION ALL
  SELECT 'Perro', 'Chihuahua'          UNION ALL
  SELECT 'Perro', 'Schnauzer'          UNION ALL
  SELECT 'Perro', 'Poodle'             UNION ALL
  SELECT 'Gato',  'Mestizo'            UNION ALL
  SELECT 'Gato',  'Siamés'             UNION ALL
  SELECT 'Gato',  'Persa'              UNION ALL
  SELECT 'Gato',  'Angora'             UNION ALL
  SELECT 'Gato',  'Maine Coon'
) r ON r.especie = e.nombre;

INSERT INTO vacuna (id_especie, nombre, descripcion, intervalo_refuerzo_dias)
SELECT e.id_especie, v.nombre, v.descripcion, v.intervalo
FROM especie e
JOIN (
  SELECT 'Perro' AS especie, 'Antirrábica' AS nombre, 'Protege contra la rabia' AS descripcion, 365 AS intervalo UNION ALL
  SELECT 'Perro', 'Polivalente canina', 'Moquillo, parvovirus, hepatitis y leptospirosis', 365 UNION ALL
  SELECT 'Perro', 'Bordetella', 'Tos de las perreras', 365 UNION ALL
  SELECT 'Gato',  'Antirrábica', 'Protege contra la rabia', 365 UNION ALL
  SELECT 'Gato',  'Triple felina', 'Panleucopenia, calicivirus y rinotraqueítis', 365 UNION ALL
  SELECT 'Gato',  'Leucemia felina', 'Protege contra el virus de la leucemia felina', 365
) v ON v.especie = e.nombre;

INSERT INTO pregunta_formulario (enunciado, tipo_respuesta, obligatoria, orden) VALUES
  ('¿Por qué quieres adoptar una mascota?',                                         'texto',  TRUE,  1),
  ('¿Has tenido mascotas antes?',                                                   'si_no',  TRUE,  2),
  ('¿Cuántas personas viven en tu hogar?',                                          'numero', TRUE,  3),
  ('¿Tu vivienda es casa o apartamento, y es propia o arrendada?',                  'texto',  TRUE,  4),
  ('¿Tienes patio o un espacio cerrado para la mascota?',                           'si_no',  TRUE,  5),
  ('¿Todas las personas de tu hogar están de acuerdo con la adopción?',             'si_no',  TRUE,  6),
  ('¿Cuántas horas al día estaría sola la mascota?',                                'numero', TRUE,  7),
  ('¿Tienes otras mascotas actualmente? Si es así, ¿cuáles?',                       'texto',  FALSE, 8),
  ('¿Quién se haría cargo de los gastos veterinarios?',                             'texto',  TRUE,  9),
  ('¿Aceptas recibir visitas o llamadas de seguimiento después de la adopción?',    'si_no',  TRUE, 10);
