-- ADVERTENCIA: este script inserta datos de prueba y puede modificar datos existentes.
-- Ejecutarlo solo en una base nueva o temporal; nunca en adopkia con datos reales.
USE adopkia;
SET @adop=(SELECT id_rol FROM rol WHERE nombre='adoptante'), @ref=(SELECT id_rol FROM rol WHERE nombre='refugio'),
    @adm=(SELECT id_rol FROM rol WHERE nombre='administrador'), @vet=(SELECT id_rol FROM rol WHERE nombre='veterinario');
INSERT INTO usuario (id_rol,nombre,correo,contrasena_hash) VALUES
 (@adop,'Ana Adoptante','ana@t.co','h'),(@ref,'Rita Refugio','rita@t.co','h'),
 (@adm,'Dani Admin','dani@t.co','h'),(@vet,'Vera Vet','vera@t.co','h'),(@adop,'Beto Libre','beto@t.co','h');
SET @ana=(SELECT id_usuario FROM usuario WHERE correo='ana@t.co'), @rita=(SELECT id_usuario FROM usuario WHERE correo='rita@t.co'),
    @dani=(SELECT id_usuario FROM usuario WHERE correo='dani@t.co'), @vera=(SELECT id_usuario FROM usuario WHERE correo='vera@t.co'),
    @beto=(SELECT id_usuario FROM usuario WHERE correo='beto@t.co');
SELECT 'T01 refugio verificado por admin (debe OK)' AS prueba;
INSERT INTO refugio (nombre,direccion,ciudad,estado_verificacion,fecha_verificacion,id_admin_verificador) VALUES ('Patitas','Cll 1','Riohacha','verificado',NOW(),@dani);
SELECT 'T02 refugio verificado por adoptante (debe FALLAR)' AS prueba;
INSERT INTO refugio (nombre,direccion,ciudad,estado_verificacion,fecha_verificacion,id_admin_verificador) VALUES ('Otro','Cll 2','Riohacha','verificado',NOW(),@ana);
SET @ref1=(SELECT id_refugio FROM refugio WHERE nombre='Patitas');
SELECT 'T03 miembro con rol adoptante (debe FALLAR)' AS prueba;
INSERT INTO miembro_refugio (id_refugio,id_usuario) VALUES (@ref1,@ana);
SELECT 'T04 miembro con rol refugio (debe OK)' AS prueba;
INSERT INTO miembro_refugio (id_refugio,id_usuario) VALUES (@ref1,@rita);
SELECT 'T05 veterinario con rol veterinario (debe OK)' AS prueba;
INSERT INTO veterinario (id_usuario,tarjeta_profesional) VALUES (@vera,'TP-1');
SET @mest=(SELECT r.id_raza FROM raza r JOIN especie e USING(id_especie) WHERE e.nombre='Perro' AND r.nombre='Mestizo');
INSERT INTO mascota (id_refugio,id_raza,nombre,tamano) VALUES (@ref1,@mest,'Firulais','mediano');
SET @masc=(SELECT id_mascota FROM mascota WHERE nombre='Firulais');
SELECT 'T06 solicitud hecha por usuario con rol refugio (debe FALLAR)' AS prueba;
INSERT INTO solicitud_adopcion (id_adoptante,id_mascota) VALUES (@rita,@masc);
SELECT 'T07 solicitud pendiente de Ana (debe OK)' AS prueba;
INSERT INTO solicitud_adopcion (id_adoptante,id_mascota) VALUES (@ana,@masc);
SELECT 'T08 segunda solicitud pendiente de Ana para la misma mascota (debe FALLAR)' AS prueba;
INSERT INTO solicitud_adopcion (id_adoptante,id_mascota) VALUES (@ana,@masc);
SELECT 'T09 otro adoptante (Beto) pendiente para la misma mascota (debe OK)' AS prueba;
INSERT INTO solicitud_adopcion (id_adoptante,id_mascota) VALUES (@beto,@masc);
SET @s_ana=(SELECT id_solicitud FROM solicitud_adopcion WHERE id_adoptante=@ana LIMIT 1);
SELECT 'T10 adopcion desde solicitud PENDIENTE (debe FALLAR)' AS prueba;
INSERT INTO adopcion (id_solicitud,fecha_adopcion) VALUES (@s_ana,CURDATE());
UPDATE solicitud_adopcion SET estado='rechazada' WHERE id_solicitud=@s_ana;
SELECT 'T11 tras rechazar, Ana puede volver a pedir (debe OK)' AS prueba;
INSERT INTO solicitud_adopcion (id_adoptante,id_mascota) VALUES (@ana,@masc);
SET @s2=(SELECT MAX(id_solicitud) FROM solicitud_adopcion WHERE id_adoptante=@ana);
UPDATE solicitud_adopcion SET estado='aprobada', fecha_respuesta=NOW() WHERE id_solicitud=@s2;
SELECT 'T12 adopcion desde solicitud APROBADA (debe OK)' AS prueba;
INSERT INTO adopcion (id_solicitud,fecha_adopcion) VALUES (@s2,CURDATE());
SET @ad=(SELECT id_adopcion FROM adopcion LIMIT 1);
SELECT 'T13 solicitud con adopcion vuelve a pendiente (debe FALLAR)' AS prueba;
UPDATE solicitud_adopcion SET estado='pendiente' WHERE id_solicitud=@s2;
SELECT 'T14 cambiar la solicitud de una adopcion (debe FALLAR)' AS prueba;
UPDATE adopcion SET id_solicitud=@s_ana WHERE id_adopcion=@ad;
SELECT 'T15 adopcion devuelta sin motivo (debe FALLAR por CHECK)' AS prueba;
UPDATE adopcion SET estado='devuelta', fecha_devolucion=CURDATE() WHERE id_adopcion=@ad;
SELECT 'T16 adopcion devuelta completa (debe OK)' AS prueba;
UPDATE adopcion SET estado='devuelta', fecha_devolucion=CURDATE(), motivo_devolucion='Alergia' WHERE id_adopcion=@ad;
SELECT 'T17 conversacion con adoptante de rol refugio (debe FALLAR)' AS prueba;
INSERT INTO conversacion (id_adoptante,id_refugio) VALUES (@rita,@ref1);
SELECT 'T18 conversacion con adoptante valido (debe OK)' AS prueba;
INSERT INTO conversacion (id_adoptante,id_refugio) VALUES (@ana,@ref1);
SELECT 'T19 cambiar rol de miembro de refugio a adoptante (debe FALLAR)' AS prueba;
UPDATE usuario SET id_rol=@adop WHERE id_usuario=@rita;
SELECT 'T20 cambiar rol de veterinario (debe FALLAR)' AS prueba;
UPDATE usuario SET id_rol=@adop WHERE id_usuario=@vera;
SELECT 'T21 cambiar rol del admin verificador (debe FALLAR)' AS prueba;
UPDATE usuario SET id_rol=@adop WHERE id_usuario=@dani;
SELECT 'T22 cambiar rol de adoptante con solicitudes (debe FALLAR)' AS prueba;
UPDATE usuario SET id_rol=@ref WHERE id_usuario=@ana;
INSERT INTO usuario (id_rol,nombre,correo,contrasena_hash) VALUES (@adop,'Sin Vinculos','sv@t.co','h');
SELECT 'T23 cambiar rol de usuario sin vinculos (debe OK)' AS prueba;
UPDATE usuario SET id_rol=@ref WHERE correo='sv@t.co';
SELECT 'T24 vista tasa de devolucion' AS prueba; SELECT * FROM vista_tasa_devolucion;
SELECT 'T25 vista mascotas disponibles (Firulais sigue disponible, refugio verificado)' AS prueba; SELECT id_mascota,nombre,especie,raza,refugio FROM vista_mascotas_disponibles;
