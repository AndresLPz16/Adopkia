# Adopkia — Backend

API REST de adopción responsable y seguimiento post-adopción. El DDL de [database/adopkia_v3.sql](./database/adopkia_v3.sql) es la única fuente del esquema físico: las tablas y columnas se guardan con los nombres españoles definidos allí; nombres de modelos, atributos Python y rutas API se mantienen en inglés. Mensajes y documentación visibles para el usuario están en español.

## Estructura del proyecto

- `manage.py`, `requirements.txt`, `README.md`, `.env.example` y `pytest.ini` están en la raíz.
- `myproject/` contiene la configuración, URLs, middleware y las plantillas Django en `myproject/templates/`.
- `users/`, `shelters/`, `pets/`, `adoptions/`, `medical/`, `messaging/` y `notifications/` contienen las apps y sus migraciones.
- `locale/` contiene los catálogos español e inglés (`.po` y `.mo`).
- `database/` contiene el DDL de referencia y sus casos SQL de prueba.
- `docs/` contiene los informes y documentos del proyecto.
- `_no_subir/` se reserva para datos locales y artefactos excluidos de Git.

Las plantillas se conservan en `myproject/templates/`: `settings.py` ya apunta a esa ubicación y moverlas requeriría cambiar configuración, fuera del alcance de la reorganización.

## Requisitos e instalación

- Python 3.12 o una versión soportada por Django 5.2.
- MySQL 8.0.16+ para validar el esquema completo, incluidos `CHECK`, columnas generadas, rutinas, triggers y vistas.
- SQLite se usa para desarrollo y pruebas que no dependen de objetos específicos de MySQL.

En PowerShell, desde esta carpeta:

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
```

Para MySQL configura en `.env` `DB_ENGINE=mysql`, `DB_NAME=adopkia`, `DB_USER=adopkia_dev`, `DB_PASSWORD`, `DB_HOST` y `DB_PORT`. La configuración restringe los nombres a `adopkia` para la app, `test_adopkia` para tests y `adopkia_cmp` para `compare_schema`. El usuario de aplicación necesita los permisos de DDL/DML sobre `adopkia`; para pruebas necesita crear y eliminar solo `test_adopkia`; para comparar necesita crear/eliminar `adopkia_cmp` y crear tablas, rutinas, triggers y vistas dentro de esa base. No se usa otro usuario para elevar permisos: si un permiso falta, el comando debe reportar el error MySQL de esa operación. No apuntes una migración inicial a una base cuyos datos quieras conservar. No almacenes credenciales reales en `.env.example`.

Para que `runserver` sirva los estáticos del admin durante el desarrollo, define `DJANGO_DEBUG=true` en `.env` y reinicia el servidor. En producción, mantén `DEBUG` desactivado y sirve los estáticos mediante el servidor/CDN configurado para ese entorno.

```powershell
python manage.py migrate
python manage.py seed_data
python manage.py runserver
```

### Ejecutar desde cero

1. Instala Python 3.12 o una versión compatible con Django 5.2 y MySQL 8.0.16+.
2. Desde la raíz del proyecto, crea y activa el entorno e instala las dependencias:

   ```powershell
   py -3.12 -m venv .venv
   .\.venv\Scripts\Activate.ps1
   python -m pip install -r requirements.txt
   ```

3. Copia `.env.example` a `.env` y configura las variables para el entorno local; no compartas el archivo `.env`.
4. Crea la base `adopkia` y carga el SQL de referencia con el usuario local autorizado:

   ```powershell
   mysql -u adopkia_dev -p -e "CREATE DATABASE adopkia CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
   cmd /c "mysql -u adopkia_dev -p adopkia < database\adopkia_v3.sql"
   ```

5. Aplica migraciones y ejecuta las pruebas:

   ```powershell
   python manage.py migrate --fake-initial
   python manage.py test --noinput
   python -m pytest --create-db
   python manage.py compare_schema
   ```

6. Inicia el servidor local:

   ```powershell
   python manage.py runserver
   ```

`seed_data` inserta de forma idempotente los cuatro roles SQL y los catálogos exactos: 2 especies, 13 razas, 6 vacunas y 10 preguntas. No crea cuentas de demostración ni perfiles que no existan en el SQL.

## Migraciones y verificación

Se regeneraron las migraciones de las apps `users`, `shelters`, `pets`, `adoptions`, `medical`, `messaging` y `notifications`; se conservaron los `migrations/__init__.py`. `makemigrations --check --dry-run` confirmó que no hay cambios de modelos pendientes.

La migración `adoptions.0002_mysql_objects` instala en MySQL únicamente las dos funciones (`fn_usuario_tiene_rol`, `fn_solicitud_aprobada`), los trece triggers y las dos vistas del SQL. Incluye SQL reverso; con SQLite es una operación vacía.

```powershell
python manage.py makemigrations --check --dry-run
python manage.py migrate
python manage.py compare_schema
python manage.py test
python -m pytest
```

`compare_schema` crea una copia temporal del script con `DROP/CREATE/USE adopkia` reescrito a `adopkia_cmp`, nunca ejecuta ese DDL contra `adopkia`, compara el esquema temporal con la base Django y elimina `adopkia_cmp` al terminar. Compara tablas, columnas, tipos, nulabilidad, PK, UNIQUE, FK/acciones ON DELETE, CHECK, funciones, triggers y vistas. Un resultado con diferencias lista cada discrepancia y sale con error.

Los tests `adoptions.test_mysql_v3_cases` reproducen los casos T01–T25 de `database/adopkia_v3_pruebas.sql`; se omiten deliberadamente en SQLite. Para ejecutar los tests MySQL, configura `DB_ENGINE=mysql` y una base limpia con permiso para crear/eliminar la base de test.

**Resultado de validación MySQL (2026-10-09):** `manage.py check` y `makemigrations --check --dry-run` terminaron con código 0 y sin cambios de modelos. `manage.py test --noinput` ejecutó 30 tests y `pytest --create-db -q` ejecutó 30; ambos terminaron con 30 aprobados y código 0. El runner `run_tests_e2e.py` había pasado 6 pruebas HTTP reales, incluido el flujo de adopción, autenticación, aislamiento por rol/objeto, mutaciones PUT/PATCH/DELETE, `/api/docs/` y el esquema OpenAPI. Para el panel, `/admin/` respondió HTTP 302 hacia el login y `/admin/login/` respondió HTTP 200 sobre `runserver`; la autenticación del usuario existente no se verificó porque no se proporcionaron sus credenciales. Solo se permiten `adopkia`, `test_adopkia` y `adopkia_cmp` con el usuario `adopkia_dev`; los datos E2E se eliminan al finalizar. `compare_schema` terminó con código 0 y cero diferencias en las 20 tablas de negocio, columnas, tipos, nulabilidad, PK, UNIQUE, FK, CHECK, funciones, triggers y vistas; `adopkia_cmp` fue eliminada al concluir.

**Validación bilingüe:** `manage.py check` no reportó problemas y `makemigrations --check --dry-run` no detectó cambios. `manage.py test --noinput` y `pytest --create-db -q` aprobaron 36 tests cada uno, incluidas las pruebas de idioma, notificaciones y etiquetas del admin; las pruebas bilingües específicas fueron 6/6. `manage.py spectacular --validate` terminó sin advertencias de esquema. En el servidor local, las especies devolvieron `Dog` con `Content-Language: en` y `Perro` con `Content-Language: es`; `/admin/`, `/en/admin/`, `/api/docs/` y `/static/admin/css/base.css` respondieron 200. El esquema OpenAPI JSON declaró versión 3.0.3. `compare_schema` informó cero diferencias y se confirmó que `adopkia_cmp` ya no existía. Los 99 rótulos de modelos/campos y las 88 cadenas gettext estáticas tienen entrada en ambos catálogos; queda una entrada vacía intencional en inglés para comprobar el fallback español.

**Índice por rol y página de entrada (2026-10-16):** se ejecutaron `manage.py check` (sin problemas), `makemigrations --check --dry-run` (sin cambios), `manage.py spectacular --validate`, `manage.py test --noinput` (41/41) y `pytest --create-db -q` (41/41; 124 subtests de matriz aprobados). Los tests cubren el índice anónimo, adoptante, refugio, veterinario y administrador, contrastando por HTTP cada recurso mostrado u oculto; también cubren la página 200 en ES/EN y el error de login por cuenta inactiva traducido. `/`, `/api/v1/`, `/api/docs/` y `/api/schema/` respondieron 200 sobre `runserver`; `/admin/` y `/en/admin/` respondieron 302 al login. `compare_schema` terminó sin diferencias en tablas, columnas, tipos, nulabilidad, PK, UNIQUE, FK, CHECK, funciones, triggers y vistas. El comparador elimina `adopkia_cmp` en un bloque `finally`, incluso ante error.

**Navegación y sesión de la página de entrada (2026-10-08):** la sesión JWT se conserva solo en `sessionStorage`; el access se renueva con el refresh y se vuelve al login si la renovación falla. Los recursos se cargan dentro de la página con History API, enlaces hash, controles de paginación y botones de regreso/inicio; el Browsable API de DRF tiene «← Volver a Adopkia». El índice anónimo agrega `message` localizado y `login_url: "/"`, sin cambiar la lista de recursos. Las pruebas del navegador con cuentas temporales de administrador y adoptante comprobaron login, apertura de mascotas, Atrás, recarga con sesión restaurada, cambio a inglés, cierre de sesión y renovación de access vencido; también se comprobó el retorno al login cuando falla el refresh. Las cuentas temporales fueron eliminadas al finalizar. `manage.py check`, `makemigrations --check --dry-run` y `manage.py spectacular --validate` pasaron; `manage.py test --noinput` aprobó 44/44 tests y `pytest --create-db -q`, 44/44 tests con 124 subtests. `compare_schema` no encontró diferencias y se confirmó la eliminación de `adopkia_cmp`; `/`, `/api/v1/`, `/api/docs/` y `/api/schema/` respondieron 200, y ambas rutas admin respondieron 302 al login.

**API navegable de DRF:** la API usa `SessionAuthentication` además de JWT y declara explícitamente `JSONRenderer` y el renderer navegable con formularios. Para iniciar sesión dentro de las páginas DRF, usa el botón `Log in` de la esquina superior derecha; `/api-auth/login/` autentica con correo y contraseña, y el menú también ofrece `Log out`. Las operaciones con sesión mantienen la protección CSRF de Django/DRF: los POST, PUT, PATCH y DELETE requieren el token CSRF. La página `/` enlaza cada recurso también en una pestaña nueva para usar sus formularios navegables; esa sesión es independiente de la sesión JWT de la página de inicio. Los formularios de creación de mascotas se ocultan en el renderer para adoptantes, veterinarios y usuarios de refugio sin membresía, sin cambiar los permisos ni las respuestas de las vistas. Las pruebas cubren registro e inicio JWT anónimos mediante formularios HTML, login de sesión por correo, CSRF, visibilidad por rol y equivalencia de los estados de lectura con JWT.

**Nota de reorganización:** los resultados de validación anteriores en este README son históricos y se obtuvieron antes de mover archivos. Las suites, `compare_schema` y rutas no se pudieron volver a ejecutar después de la reorganización en esta sesión; no los tomes como verificación posterior a los movimientos.

**Diferencias intencionales:** se permite la diferencia de signo en enteros (signed en Django frente a `UNSIGNED` en el SQL), tal como autorizan los requisitos; el comparador normaliza esa diferencia. Se excluyen de la comparación las tablas internas de Django `django_migrations`, `django_content_type`, `django_admin_log`, `django_session`, `auth_group`, `auth_group_permissions` y `auth_permission`. Estas seis últimas tablas son necesarias para sesiones y el panel; no son tablas de negocio y no cambian las 20 tablas del modelo.

## API y autenticación

Prefijo funcional: `/api/v1/`. Autenticación JWT: registro `POST /api/v1/auth/register/`, login `POST /api/v1/auth/login/`, refresh `POST /api/v1/auth/refresh/` y perfil propio `/api/v1/auth/me/`. Swagger: `/api/docs/`.

La raíz `/` presenta una página de entrada en español o inglés. Tras autenticar, guarda access y refresh JWT en `sessionStorage` (solo hasta cerrar la pestaña), nunca en `localStorage` ni cookies. Al cargar, valida la sesión; si venció el access, solicita uno nuevo mediante `/api/v1/auth/refresh/`, y si el refresh no sirve borra la sesión y vuelve al login. Tras autenticar, muestra el rol y enlaces del índice `GET /api/v1/`. Los recursos se consultan dentro de la misma página con el token y el idioma seleccionado; los resultados paginados cuentan con botones anterior/siguiente. La navegación usa hashes y History API; Atrás vuelve a la vista previa sin presentar el login mientras la sesión siga válida. Los botones «← Volver» e «Inicio» permiten regresar a la lista o al menú. Administración y documentación se abren en una pestaña nueva sin compartir el token. El índice anónimo conserva sus recursos públicos e informa, en el idioma solicitado, que debe iniciarse sesión en `/` para ver los enlaces disponibles para su rol. Para usuarios autenticados, el índice usa la tabla central `ROLE_RESOURCES`. La presentación de enlaces no concede permisos: cada endpoint conserva su propia autorización.

La matriz del índice se contrasta en tests contra el acceso HTTP real a cada recurso para adoptante, refugio, veterinario, administrador y anónimo. Los recursos listados deben responder 2xx o 405 (por ejemplo, una ruta de login consultada con GET); los no listados deben responder 401 o 403. La página ofrece cierre de sesión, y los errores de credenciales/cuenta inactiva se muestran en el idioma seleccionado. Las páginas navegables del browsable API de DRF incluyen «← Volver a Adopkia».

El panel de administración de Django está disponible en `/admin/`. Se inicia sesión con el correo y la contraseña habituales; solo las cuentas activas con rol `administrador` tienen acceso. El panel muestra los modelos registrados en modo de solo lectura y no expone el hash de contraseña.

### Idiomas

El backend responde en español por defecto. Para solicitar inglés, agrega `?lang=en` a la URL; `?lang=es` fuerza español. El parámetro `lang` tiene prioridad sobre la cabecera HTTP `Accept-Language`. Si el parámetro no es `es` o `en`, se aplica `Accept-Language` y, si no selecciona un idioma soportado, se usa español. Las respuestas incluyen `Content-Language`.

El panel conserva `/admin/` para español y está disponible también en `/en/admin/` para inglés. La selección `?lang=` aplica igualmente a las peticiones de API.

Se traducen las etiquetas del panel y de los campos de los modelos, los errores y respuestas estáticos de la API, los permisos, los errores de triggers, los catálogos de especie/raza/vacuna/preguntas, los valores de estado y los mensajes de notificación generados por el sistema. Los nombres, descripciones, respuestas de formularios y mensajes escritos por usuarios se conservan tal como fueron ingresados; no se traducen los datos de contenido libre. Las traducciones usan el catálogo español como fuente y recurren a ese texto cuando falta una traducción inglesa.

| Recurso | Rutas principales |
|---|---|
| Refugios y miembros | `/shelters/`, `/shelter-members/`, `POST /shelters/{id}/verify/` |
| Especies, razas, mascotas y fotos | `/species/`, `/breeds/`, `/pets/`, `/pet-photos/` |
| Preguntas, solicitudes, adopciones y seguimientos | `/form-questions/`, `/adoption-requests/`, `/adoptions/`, `/follow-ups/` |
| Veterinarios aliados, historial, vacunas y recordatorios | `/veterinarians/`, `/medical-records/`, `/vaccines/`, `/reminders/` |
| Mensajes y notificaciones | `/conversations/`, `/messages/`, `/notifications/` |
| Estadísticas | `GET /api/v1/statistics/adoptions/` |
| Documentación OpenAPI | `/api/schema/`, `/api/docs/` |

Las mascotas se filtran por especie derivada de raza, raza, ciudad, estado y tamaño. La edad se calcula desde `fecha_nacimiento_aprox`; no se almacena. La foto se registra guardando su URL en `foto_mascota.url`; el backend no almacena el archivo binario. Veterinarios aliados pueden registrar atenciones en cualquier mascota y consultar historiales. Cada mensaje y cada transición de estado de solicitud genera una sola notificación, con `tipo` de los seis valores del DDL.

### Inventario de rutas HTTP y permisos

Las rutas siguientes se encuentran bajo `/api/v1/`, salvo `/api/schema/` y `/api/docs/`. Los métodos de solo lectura o no expuestos por el router no se consideran permisos de escritura.

| Ruta | Métodos | Vista | Permiso / alcance |
|---|---|---|---|
| `/` | `GET` | `TemplateView` | Público; página de login y navegación interna |
| `/api/v1/` | `GET` | `ApiIndexView` | Público (`AllowAny`); índice de rutas por rol y mensaje de acceso para anónimos |
| `/auth/register/` | `POST` | `RegisterView` | Público; el serializer no permite asignar roles privilegiados |
| `/auth/login/` | `POST` | `TokenObtainPairView` | Público; autentica cuentas activas |
| `/auth/refresh/` | `POST` | `TokenRefreshView` | Público con refresh token válido |
| `/auth/me/` | `GET`, `PUT`, `PATCH` | `ProfileView` | Autenticado; solo perfil propio |
| `/shelters/`, `/shelters/{id}/` | `GET`, `POST`, `PUT`, `PATCH`, `DELETE` | `ShelterViewSet` | Lectura anónima limitada a refugios verificados y a `name`, `city`, `description`; detalles completos solo para administrador o miembro del refugio. Crear como refugio/admin; modificar/eliminar como administrador o integrante autorizado |
| Nota sobre refugios públicos | — | `PublicShelterSerializer` | `database/adopkia_v3.sql` no define una columna de descripción para refugios; por ello `description` se incluye como `null`. No se añadió columna ni se expusieron datos privados como sustituto |
| `/shelters/{id}/verify/` | `POST` | `ShelterViewSet.verify` | Administrador |
| `/shelters/{id}/members/` | `GET`, `POST` | `ShelterViewSet.members` | Integrante autorizado para leer; responsable del refugio para agregar |
| `/shelter-members/`, `/shelter-members/{id}/` | `GET`; detalle `GET`, `PATCH`, `DELETE` | `ShelterMemberViewSet` | Autenticado y limitado al refugio propio; solo responsable modifica/elimina; admin puede leer globalmente |
| `/species/`, `/species/{id}/` | `GET` | `SpeciesViewSet` | Público; solo lectura |
| `/breeds/`, `/breeds/{id}/` | `GET` | `BreedViewSet` | Público; solo lectura |
| `/pets/`, `/pets/{id}/` | `GET`, `POST`, `PUT`, `PATCH`, `DELETE` | `PetViewSet` | Lectura pública para refugios verificados; escribir como administrador o integrante del refugio dueño |
| `/pets/{id}/relist/` | `POST` | `PetViewSet.relist` | Administrador o integrante del refugio dueño; solo mascota devuelta |
| `/pet-photos/`, `/pet-photos/{id}/` | `GET`, `POST`; detalle `GET`, `DELETE` | `PetPhotoViewSet` | Autenticado; solo administrador o integrante autorizado del refugio dueño para escribir; PUT/PATCH no expuestos |
| `/form-questions/`, `/form-questions/{id}/` | `GET` | `FormQuestionViewSet` | Público; solo lectura |
| `/adoption-requests/` | `GET`, `POST` | `AdoptionRequestViewSet` | Autenticado; crear como adoptante; listados limitados por actor |
| `/adoption-requests/{id}/` | `GET`, `PATCH` | `AdoptionRequestViewSet` | Autenticado; lectura por ámbito; PATCH solo solicitante y mientras esté pendiente |
| `/adoption-requests/{id}/approve/`, `/reject/` | `POST` | `AdoptionRequestViewSet` | Administrador o integrante del refugio dueño de la mascota |
| `/adoption-requests/{id}/cancel/` | `POST` | `AdoptionRequestViewSet` | Adoptante dueño de la solicitud |
| `/adoptions/`, `/adoptions/{id}/` | `GET` | `AdoptionViewSet` | Autenticado; consulta limitada al adoptante/refugio; administrador global |
| `/adoptions/{id}/return/` | `POST` | `AdoptionViewSet.return_adoption` | Administrador o integrante del refugio de la mascota; fecha/motivo validados |
| `/follow-ups/`, `/follow-ups/{id}/` | `GET`, `POST`; detalle `GET`, `PATCH`, `DELETE` | `FollowUpViewSet` | Autenticado; escritura por administrador o integrante del refugio de la adopción |
| `/veterinarians/`, `/veterinarians/{id}/` | `GET`, `POST`; detalle `GET`, `PATCH` | `VeterinarianViewSet` | Perfil propio para veterinario; admin/refugio pueden consultar; PUT/DELETE no expuestos |
| `/medical-records/`, `/medical-records/{id}/` | `GET`, `POST`, `PUT`, `PATCH`, `DELETE` | `MedicalRecordViewSet` | Autenticado; acceso según veterinario, administrador o refugio dueño |
| `/vaccines/`, `/vaccines/{id}/` | `GET` | `VaccineViewSet` | Público; solo lectura |
| `/reminders/`, `/reminders/{id}/` | `GET`, `POST`, `PUT`, `PATCH`, `DELETE` | `ReminderViewSet` | Autenticado; adoptante dueño, refugio responsable o administrador |
| `/conversations/`, `/conversations/{id}/` | `GET`, `POST`, `PUT`, `PATCH`, `DELETE` | `ConversationViewSet` | Autenticado; crear como adoptante; lectura/escritura según participación; modificar participantes no permitido |
| `/messages/`, `/messages/{id}/` | `GET`, `POST`, `PATCH`, `DELETE` | `MessageViewSet` | Autenticado; participantes; modificar/eliminar solo mensaje propio no leído; PUT no expuesto |
| `/messages/{id}/mark-read/` | `POST` | `MessageViewSet.mark_read` | Participante receptor; no el remitente |
| `/notifications/`, `/notifications/{id}/` | `GET`, `PATCH`, `DELETE` | `NotificationViewSet` | Autenticado; solo notificaciones propias; PATCH solo `is_read` |
| `/statistics/adoptions/` | `GET` | `AdoptionStatisticsView` | Solo administrador |
| `/api/schema/` | `GET` | `SpectacularAPIView` | Esquema OpenAPI |
| `/api/docs/` | `GET` | `SpectacularSwaggerView` | Documentación Swagger |

## RF → endpoint

La numeración conserva el orden de los requerimientos funcionales del documento del proyecto.

| RF | Funcionalidad | Endpoint | Resultado HTTP |
|---|---|---|---|
| RF1 | Registro y autenticación | `POST /api/v1/auth/register/`, `/login/`, `/refresh/`, `GET/PATCH /api/v1/auth/me/` | Pasó: registro, JWT, refresh y perfil de los cuatro roles |
| RF2 | Publicar y mantener mascotas/fotos | CRUD `/api/v1/pets/`, `/api/v1/pet-photos/` | Pasó: publicación, actualización y foto por URL |
| RF3 | Buscar mascotas por especie, raza, ciudad y estado | `GET /api/v1/pets/?species=&breed=&city=&status=` | Pasó: filtros y paginación |
| RF4 | Formulario y solicitud | `GET /api/v1/form-questions/`, `POST /api/v1/adoption-requests/` | Pasó: envío, persistencia y duplicado pendiente rechazado |
| RF5 | Decidir solicitud y registrar adopción | `POST /api/v1/adoption-requests/{id}/approve/`, `/reject/`; `/api/v1/adoptions/` | Pasó: aprobación crea adopción, actualiza mascota y notifica una vez |
| RF6 | Notificar solicitudes, mensajes y recordatorios | `/api/v1/notifications/`; `python manage.py send_reminders` | Pasó: notificaciones de solicitud y mensaje sin duplicados; recordatorio enviado |
| RF7 | Seguimiento post-adopción | CRUD `/api/v1/follow-ups/` | Pasó: registro y persistencia del seguimiento |
| RF8 | Atención veterinaria y recordatorios | `/api/v1/medical-records/`, `/api/v1/vaccines/`, `/api/v1/reminders/` | Pasó: historial, vacunación y recordatorio |
| RF9 | Estadística de devoluciones | `GET /api/v1/statistics/adoptions/` | Pasó: administrador 200; otros roles 403; anónimo 401 |
| RF10 | Refugios y verificación | `/api/v1/shelters/`, `/api/v1/shelter-members/`, `POST /api/v1/shelters/{id}/verify/` | Pasó: verificación, membresía y aislamiento entre refugios |
| RF11 | Conversación adoptante–refugio | `/api/v1/conversations/`, `/api/v1/messages/` | Pasó: intercambio y una notificación por mensaje |

La evidencia anterior corresponde a comandos ejecutados en MySQL y a seis pruebas del runner HTTP; no extrapola resultados a rutas o acciones no incluidas en dichas pruebas.

### Matriz de permisos verificada por HTTP

Las colecciones públicas probadas (`shelters`, `species`, `breeds`, `pets`, `form-questions`, `vaccines`) responden 200 sin autenticación. Para colecciones protegidas, el anónimo recibe 401 y los cuatro roles autenticados reciben 200; los datos de usuario/objeto se validan además por propietario y refugio. La estadística responde 200 solo al administrador: 403 a adoptante, refugio y veterinario, y 401 al anónimo.

| Recurso / acción probada | Adoptante | Refugio responsable | Administrador | Veterinario | Anónimo |
|---|---|---|---|---|---|
| Lectura de colecciones protegidas | 200, alcance propio verificado | 200, acceso autenticado | 200 | 200 | 401 |
| Refugios y mascotas: PUT/PATCH/DELETE propios | 403 | 200/204 en objetos propios | 200/204 en los objetos probados | No concedido en mutaciones probadas | 401 |
| Refugios y mascotas de otro refugio | 403 | 403 | Acciones administrativas probadas: 200/204 | No concedido en mutaciones probadas | 401 |
| Solicitudes | Crear/editar/cancelar propias; otro adoptante recibe 404 | No crea; decide solicitudes de su refugio | No crea ni decide como refugio | No crea ni aprueba/rechaza (403/404) | 401 |
| Adopciones y seguimientos | No administra seguimientos (403) | Gestiona seguimiento de su adopción | No se conceden mutaciones no probadas | Lectura autenticada; no se conceden mutaciones no probadas | 401 |
| Historial médico | No borra historial ajeno (403) | No se concede escritura | No se concede escritura | POST/PUT/PATCH/DELETE propios: 201/200/200/204 | 401 |
| Conversaciones y mensajes | Participa; edita mensaje propio no leído y lo borra; objetos ajenos 404 | Participa en su refugio; mensaje ajeno no se borra (403) | No crea conversación ni mensaje; borrado de mensaje ajeno 403 | No crea conversación ni envía mensaje (403) | 401 |
| Notificaciones | Marca y elimina las propias; ajenas 404 | Lectura autenticada; mutaciones no concedidas | Lectura autenticada; mutaciones no concedidas | Lectura autenticada; mutaciones no concedidas | 401 |
| Estadística de adopciones | 403 | 403 | 200 | 403 | 401 |

Los métodos no implementados para el recurso/método ejercitado responden 405; no se interpretan como permisos concedidos. Para detalles de las solicitudes concretas y códigos por cada acción, véase `tests_e2e/e2e_04_permission_matrix.py`.

`send_reminders` envía notificación únicamente a la persona adoptante titular de la adopción y cambia el estado del recordatorio a `notificado`, lo que vuelve idempotente su ejecución programada:

```powershell
python manage.py send_reminders --days 7
```

## Esquema SQL v3 y cardinalidades

`PK` indica clave primaria; `FK` incluye `ON DELETE`; `UQ` indica unicidad; `?` significa nullable. Los IDs del SQL son `INT UNSIGNED AUTO_INCREMENT`, salvo `rol.id_rol` (`TINYINT UNSIGNED`). Las fechas/hora SQL son `DATETIME`, fechas calendario `DATE`, indicadores booleanos `BOOLEAN`, los tipos enumerados `ENUM` con las opciones que muestra el DDL. Las FKs que no declaran explícitamente `ON DELETE` usan la acción por defecto de MySQL (RESTRICT/NO ACTION).

| Tabla | Columnas (tipo; claves/restricciones) | Cardinalidad principal |
|---|---|---|
| `rol` | `id_rol TINYINT PK`; `nombre VARCHAR(30) UQ`; `descripcion VARCHAR(150)?` | Rol 1:N usuario. |
| `usuario` | `id_usuario INT PK`; `id_rol TINYINT FK→rol`; `nombre VARCHAR(100)`; `correo VARCHAR(150) UQ`; `contrasena_hash VARCHAR(255)`; `telefono VARCHAR(20)?`; `activo BOOLEAN`; `fecha_registro DATETIME` | Usuario 1:N solicitudes, notificaciones, mensajes y conversaciones; 1:0..1 membresía, veterinario. |
| `refugio` | `id_refugio INT PK`; `nombre VARCHAR(120)`; `direccion VARCHAR(200)`; `ciudad VARCHAR(80)`; `telefono_contacto VARCHAR(20)?`; `correo_contacto VARCHAR(150)?`; `estado_verificacion ENUM`; `fecha_verificacion DATETIME?`; `id_admin_verificador INT FK→usuario?`; `fecha_registro DATETIME`; `UQ(nombre,ciudad)`; `CHECK` de verificación | Refugio 1:N miembros, mascotas y conversaciones; validador 0..1 usuario administrador. |
| `miembro_refugio` | `id_miembro INT PK`; `id_refugio INT FK→refugio CASCADE`; `id_usuario INT FK→usuario CASCADE UQ`; `cargo ENUM(responsable,colaborador)` | Refugio 1:N integrantes; usuario 0..1 refugio. |
| `veterinario` | `id_veterinario INT PK`; `id_usuario INT FK→usuario CASCADE UQ`; `tarjeta_profesional VARCHAR(30) UQ`; `clinica VARCHAR(120)?`; `especialidad VARCHAR(80)?` | Usuario 1:0..1 ficha veterinaria; veterinario 1:N historial. |
| `especie` | `id_especie INT PK`; `nombre VARCHAR(50) UQ` | Especie 1:N razas y vacunas. |
| `raza` | `id_raza INT PK`; `id_especie INT FK→especie`; `nombre VARCHAR(80)`; `UQ(id_especie,nombre)` | Especie 1:N razas; raza 1:N mascotas. |
| `mascota` | `id_mascota INT PK`; `id_refugio INT FK→refugio`; `id_raza INT FK→raza`; `nombre VARCHAR(80)`; `fecha_nacimiento_aprox DATE?`; `tamano ENUM`; `salud TEXT?`; `temperamento VARCHAR(150)?`; `estado ENUM`; `fecha_publicacion DATETIME` | Refugio y raza 1:N mascotas; mascota 1:N fotos, solicitudes, historial, conversaciones opcionales. Especie se deriva de raza. |
| `foto_mascota` | `id_foto INT PK`; `id_mascota INT FK→mascota CASCADE`; `url VARCHAR(500)`; `es_principal BOOLEAN`; `fecha_subida DATETIME` | Mascota 1:N fotos. |
| `pregunta_formulario` | `id_pregunta INT PK`; `enunciado VARCHAR(300)`; `tipo_respuesta ENUM`; `obligatoria BOOLEAN`; `orden SMALLINT`; `activa BOOLEAN` | Pregunta 1:N respuestas. |
| `solicitud_adopcion` | `id_solicitud INT PK`; `id_adoptante INT FK→usuario`; `id_mascota INT FK→mascota`; `fecha_solicitud DATETIME`; `estado ENUM`; `fecha_respuesta DATETIME?`; `observaciones_refugio VARCHAR(500)?`; `pendiente_unica TINYINT GENERATED STORED`; `UQ(id_adoptante,id_mascota,pendiente_unica)` | Adoptante/mascota 1:N solicitudes; solicitud 1:N respuestas y 0..1 adopción. |
| `respuesta` | `id_solicitud INT PK/FK→solicitud CASCADE`; `id_pregunta INT PK/FK→pregunta`; `valor TEXT`; PK compuesta `(id_solicitud,id_pregunta)` | Respuesta pertenece a una solicitud y pregunta; cada pareja solo una vez. |
| `adopcion` | `id_adopcion INT PK`; `id_solicitud INT FK→solicitud UQ`; `fecha_adopcion DATE`; `estado ENUM`; `fecha_devolucion DATE?`; `motivo_devolucion VARCHAR(500)?`; `CHECK` de coherencia de devolución | Solicitud 0..1 adopción; adopción 1:N seguimientos y recordatorios. |
| `seguimiento` | `id_seguimiento INT PK`; `id_adopcion INT FK→adopcion CASCADE`; `id_registrado_por INT FK→usuario SET NULL?`; `fecha DATE`; `bienestar ENUM`; `observaciones TEXT?` | Adopción 1:N seguimientos. |
| `vacuna` | `id_vacuna INT PK`; `id_especie INT FK→especie`; `nombre VARCHAR(100)`; `descripcion VARCHAR(255)?`; `intervalo_refuerzo_dias SMALLINT?`; `UQ(id_especie,nombre)` | Especie 1:N vacunas; vacuna 0..N registros y recordatorios. |
| `historial_medico` | `id_historial INT PK`; `id_mascota INT FK→mascota CASCADE`; `id_veterinario INT FK→veterinario SET NULL?`; `id_vacuna INT FK→vacuna?`; `fecha DATE`; `tipo ENUM`; `descripcion TEXT?`; `CHECK(id_vacuna IS NULL OR tipo='vacunacion')` | Mascota 1:N atenciones; veterinario/vacuna 0..N atenciones; historial 0..N recordatorios. |
| `recordatorio` | `id_recordatorio INT PK`; `id_adopcion INT FK→adopcion CASCADE`; `id_vacuna INT FK→vacuna?`; `id_historial INT FK→historial_medico SET NULL?`; `tipo ENUM`; `fecha_programada DATE`; `estado ENUM`; `CHECK` de vacuna | Adopción 1:N recordatorios; recordatorio 0..N notificaciones. |
| `notificacion` | `id_notificacion INT PK`; `id_usuario INT FK→usuario CASCADE`; `id_solicitud INT FK→solicitud SET NULL?`; `id_recordatorio INT FK→recordatorio SET NULL?`; `tipo ENUM`; `mensaje VARCHAR(500)`; `fecha_envio DATETIME`; `leida BOOLEAN` | Usuario 1:N notificaciones; solicitud/recordatorio 0..N notificaciones. |
| `conversacion` | `id_conversacion INT PK`; `id_adoptante INT FK→usuario CASCADE`; `id_refugio INT FK→refugio CASCADE`; `id_mascota INT FK→mascota SET NULL?`; `fecha_inicio DATETIME` | Adoptante/refugio 1:N conversaciones; conversación 1:N mensajes. |
| `mensaje` | `id_mensaje INT PK`; `id_conversacion INT FK→conversacion CASCADE`; `id_remitente INT FK→usuario`; `contenido TEXT`; `fecha_envio DATETIME`; `leido BOOLEAN` | Conversación y remitente 1:N mensajes. |

No hay una tabla independiente de asignaciones veterinarias ni una tabla separada de aplicaciones de vacunas. La vacunación se representa como un registro médico de tipo `vacunacion`; el veterinario aliado puede registrar atenciones sin asignación previa a una mascota. `django_migrations` es infraestructura interna y no una tabla de negocio del DER.

## Diferencias intencionales y resultados observados

- Aceptada explícitamente: enteros con signo en vez de `UNSIGNED`, cuando corresponda.
- Infraestructura: las tablas internas de Django (`django_migrations`, `django_content_type`, `django_admin_log`, `django_session`, `auth_group`, `auth_group_permissions` y `auth_permission`) quedan fuera del esquema de negocio y de la comparación.
- `compare_schema` verificó 20 tablas, 31 relaciones FK, las funciones 2, triggers 13 y vistas 2, sin diferencias en las categorías comparadas; la base de comparación `adopkia_cmp` se eliminó al terminar.
- No se declaran otras diferencias intencionales. Las suites y pruebas HTTP anteriores se ejecutaron contra MySQL; no son resultados simulados.
