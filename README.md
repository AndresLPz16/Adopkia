# Adopkia — Backend

API REST de adopción responsable y seguimiento post-adopción. Las migraciones de Django son el camino oficial para crear y actualizar el esquema; [database/adopkia_v3.sql](./database/adopkia_v3.sql) es la referencia del modelo físico para el DER, MySQL Workbench y `compare_schema`. Las tablas y columnas usan los nombres españoles del SQL; los modelos, atributos Python y rutas API se mantienen en inglés.

## Estructura del proyecto

- `manage.py`, `requirements.txt`, `requirements-dev.txt`, `requirements.lock.txt`, `.env.example` y `pytest.ini` están en la raíz.
- `myproject/` contiene la configuración, URLs, middleware, autenticación y renderers.
- `users/`, `shelters/`, `pets/`, `adoptions/`, `medical/`, `messaging/` y `notifications/` contienen las apps y sus migraciones.
- `locale/` contiene los catálogos español e inglés (`.po` y `.mo`).
- `database/` contiene el DDL de referencia y sus casos SQL de prueba.
- `docs/` contiene los informes y documentos del proyecto.
- `_no_subir/` se reserva para datos locales y artefactos excluidos de Git.

## Requisitos e instalación

- Python 3.12.10 fue la versión usada para la prueba de instalación limpia.
- Django 5.2 y sus dependencias requieren una versión de Python compatible; se recomienda usar Python 3.12.
- MySQL 8.0.16+ para validar el esquema completo, incluidos `CHECK`, columnas generadas, rutinas, triggers y vistas.

El proyecto y los valores de `.env.example` son para desarrollo local, no una configuración lista para producción. En producción usa `DJANGO_DEBUG=false`, una `DJANGO_SECRET_KEY` aleatoria y secreta, `DJANGO_ALLOWED_HOSTS` limitado a los dominios reales, `DJANGO_CORS_ALLOWED_ORIGINS` limitado a los orígenes autorizados y credenciales de base de datos protegidas. Para MySQL, con `DJANGO_DEBUG=false` el cliente verifica TLS y el nombre del servidor por defecto (`DB_SSL_MODE=verify_identity`); puedes definir `DB_SSL_CA` si necesitas una CA específica. El modo `DB_SSL_MODE=disabled` solo se permite con debug para la base local de desarrollo. Configura HTTPS, HSTS y cookies seguras en el despliegue/servidor; esos ajustes no se habilitan en este proyecto.

Para una imagen de producción en Azure, usa `Dockerfile.azure` en lugar de `Dockerfile`. Esta variante aplica migraciones y catálogos base y sirve Django con Gunicorn; no importa las cuentas demo. Inyecta en el entorno de Azure `DJANGO_SECRET_KEY`, `DJANGO_ALLOWED_HOSTS` y las credenciales/endpoints MySQL reales. El `Dockerfile` y Compose existentes siguen siendo el flujo local de desarrollo.

Para el desarrollo se recomienda instalar el conjunto de dependencias de desarrollo con el lock probado:

```powershell
python -m pip install -r requirements-dev.txt -c requirements.lock.txt
```

`requirements.txt` contiene solo dependencias de ejecución. Para instalar únicamente la aplicación:

```powershell
python -m pip install -r requirements.txt -c requirements.lock.txt
```

### Cliente MySQL

- **Windows:** instala MySQL Server o MySQL Shell desde MySQL Installer oficial; incluye `mysql.exe` con MySQL Server. Añade la carpeta `bin` de MySQL al `PATH` si PowerShell no encuentra `mysql`.
- **Ubuntu/Debian:** `sudo apt update && sudo apt install mysql-client`.
- **Fedora/RHEL:** `sudo dnf install mysql`.
- **macOS con Homebrew:** `brew install mysql-client`; añade `$(brew --prefix mysql-client)/bin` al `PATH`.

PyMySQL es el driver Python y no necesita compilar `mysqlclient`. El cliente `mysql` solo es necesario para ejecutar comandos SQL desde la terminal.

### Instalación limpia oficial

El único flujo oficial de instalación del esquema es **migraciones Django**, seguido de los datos base. No ejecutes `database/adopkia_v3.sql` sobre esa misma base: es un DDL de referencia y contiene comentarios/definiciones del esquema que pueden no ser idempotentes frente a las migraciones. No uses `migrate --fake-initial` para combinar los dos caminos.

#### PowerShell (Windows)

**Inicio rápido recomendado (MySQL con Docker Compose):** instala y abre Docker Desktop. Desde la raíz del repositorio ejecuta:

```powershell
docker compose up --build
```

Compose inicia MySQL 8, espera a que la comprobación de salud confirme que acepta conexiones, y después construye e inicia Django. El contenedor de Django aplica las migraciones, carga los catálogos y, si la base todavía no tiene usuarios, importa el conjunto de demostración compartido antes de servir la aplicación en <http://127.0.0.1:8000/>. El fixture contiene 42 usuarios de demostración y sus registros relacionados; por eso se puede usar en instalaciones nuevas el mismo correo y la contraseña correspondiente. Las contraseñas están almacenadas únicamente como hashes. Estos datos son solo para desarrollo y evaluación académica; no los uses en producción. No hace falta copiar `.env.example` ni instalar MySQL en Windows para este flujo.

Con una base nueva, inicia sesión con una de las cuentas administradoras del conjunto de demostración. Si prefieres crear otro administrador:

```powershell
docker compose exec web python manage.py createsuperuser
```

Detén los servicios con `Ctrl+C`; `docker compose down` conserva los datos de MySQL. **No ejecutes `docker compose down --volumes` si quieres conservarlos:** elimina el volumen de la base. El conjunto de demostración se importa solo en una base sin usuarios; un volumen existente no se reemplaza ni se actualiza automáticamente.

**Alternativa: Python y MySQL instalados localmente.** Este modo requiere MySQL en ejecución, la base y el usuario creados con permisos, y credenciales válidas en `.env`:

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements-dev.txt -c requirements.lock.txt
Copy-Item .env.example .env
```

Edita `.env` localmente, sin compartirlo: define `DJANGO_SECRET_KEY`, `DJANGO_DEBUG=true`, `DJANGO_ALLOWED_HOSTS`, `DB_ENGINE=mysql`, `DB_NAME=adopkia`, `DB_USER=adopkia_dev`, `DB_PASSWORD`, `DB_HOST` y `DB_PORT`. La aplicación falla explícitamente si falta `DJANGO_SECRET_KEY` o, para MySQL, `DB_PASSWORD`.

Las variables de entorno ya definidas en PowerShell prevalecen sobre `.env`. Si `DB_ENGINE` se estableció previamente como `sqlite`, elimina ese valor antes de iniciar el servidor, o establécelo explícitamente como `mysql`. Verifica el motor y la base efectivos antes de iniciar sesión:

```powershell
$env:DB_ENGINE = "mysql"
python manage.py shell -c "from django.db import connection; print(connection.vendor, connection.settings_dict['NAME'])"
```

El resultado esperado es `mysql adopkia`. Usa el mismo entorno y la misma carpeta del proyecto para `migrate`, `createsuperuser` y `runserver`; cambiar de motor conecta a otra base y sus usuarios no se comparten.

En la alternativa local, crea la base y el usuario MySQL con una cuenta administradora. Sustituye `elige-una-clave-local` y configura exactamente la misma contraseña como `DB_PASSWORD` en `.env`:

```sql
CREATE DATABASE IF NOT EXISTS adopkia CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'adopkia_dev'@'127.0.0.1' IDENTIFIED BY 'elige-una-clave-local';
ALTER USER 'adopkia_dev'@'127.0.0.1' IDENTIFIED BY 'elige-una-clave-local';
GRANT ALL PRIVILEGES ON adopkia.* TO 'adopkia_dev'@'127.0.0.1';
```

```powershell
python manage.py migrate
python manage.py seed_data
python manage.py load_demo_data
python manage.py createsuperuser
python manage.py runserver
```

#### Linux/macOS (Bash)

Con Docker instalado y ejecutándose, el inicio rápido es igual:

```bash
docker compose up --build
```

En otra terminal, crea tu administrador con `docker compose exec web python manage.py createsuperuser`. Para detenerlo, pulsa `Ctrl+C` y ejecuta `docker compose down`; no añadas `--volumes` salvo que quieras borrar los datos locales de MySQL.

**Alternativa: Python y MySQL instalados localmente:**

```bash
python3.12 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements-dev.txt -c requirements.lock.txt
cp .env.example .env
```

Edita `.env` localmente con las mismas variables que se indican arriba. Continúa con los mismos comandos de base y Django:

```bash
python manage.py migrate
python manage.py seed_data
python manage.py load_demo_data
python manage.py createsuperuser
python manage.py runserver
```

`createsuperuser` solicita de forma interactiva el correo, nombre y contraseña; el manager asigna el rol administrador. `seed_data` carga idempotentemente los cuatro roles y catálogos base (2 especies, 13 razas, 6 vacunas y 10 preguntas).

Para ejecutar pruebas, activa el entorno virtual y usa:

```powershell
python -W error::DeprecationWarning manage.py test --noinput
python -m pytest --create-db -W error::DeprecationWarning
```

En Linux/macOS los mismos comandos se ejecutan en la terminal. Los tests MySQL pueden crear y eliminar únicamente la base de pruebas `test_adopkia`; asegúrate de no guardar datos importantes en ella.

`compare_schema` lee el DDL de referencia, lo ejecuta sobre una base temporal `adopkia_cmp`, compara tablas, columnas, tipos, nulabilidad, claves, checks, funciones, triggers y vistas con `adopkia`, y elimina solo la base temporal que creó. Si `adopkia_cmp` ya existe, el comando se detiene; `--force` la reemplaza de forma explícita. El usuario MySQL debe poder crear/eliminar `adopkia_cmp` y definir tablas, funciones, triggers y vistas.

**Advertencias de SQL:** `database/adopkia_v3.sql` contiene una sentencia `DROP DATABASE adopkia` comentada; ejecutarla manualmente borra todos los datos y solo debe hacerse para reinstalar deliberadamente desde cero. `database/adopkia_v3_pruebas.sql` inserta datos de prueba: úsalo solo en una base nueva o temporal, nunca en `adopkia` con datos reales.

## Migraciones y verificación

Se regeneraron las migraciones de las apps `users`, `shelters`, `pets`, `adoptions`, `medical`, `messaging` y `notifications`; se conservaron los `migrations/__init__.py`. `makemigrations --check --dry-run` confirmó que no hay cambios de modelos pendientes.

La migración `adoptions.0002_mysql_objects` instala en MySQL las dos funciones (`fn_usuario_tiene_rol`, `fn_solicitud_aprobada`), los trece triggers y las dos vistas. Incluye SQL reverso; con SQLite es una operación vacía.

```powershell
python manage.py makemigrations --check
python manage.py migrate
python manage.py compare_schema
python manage.py test --noinput
python -m pytest --create-db
```

`compare_schema` reescribe el DDL de referencia para crear una base temporal `adopkia_cmp`, nunca ejecuta una operación de borrado sobre `adopkia`, compara el esquema temporal con la base Django y elimina únicamente `adopkia_cmp` si lo creó en esa ejecución. Si `adopkia_cmp` existe, aborta; `--force` reemplaza explícitamente esa base temporal. Compara tablas, columnas, tipos, nulabilidad, PK, UNIQUE, FK/acciones ON DELETE, CHECK, funciones, triggers y vistas. Un resultado con diferencias lista cada discrepancia y termina con error.

Los tests `adoptions.test_mysql_v3_cases` ejercitan casos de integridad MySQL; se omiten en SQLite. Para ejecutar esas pruebas, configura `DB_ENGINE=mysql` y concede al usuario de desarrollo permiso de crear/eliminar la base de pruebas `test_adopkia`.

**Índice de la API por rol:** `/` y `/api/v1/` sirven el índice de DRF directamente. El índice mantiene sus recursos y permisos existentes; el anónimo ve solo recursos públicos y recibe un enlace al login de sesión de DRF, mientras que una sesión autenticada ve los recursos de su rol.

**API navegable de DRF:** la API usa `SessionAuthentication` además de JWT y declara explícitamente `JSONRenderer` y el renderer navegable con formularios. Para iniciar sesión, usa el botón `Log in` de la esquina superior derecha; `/api-auth/login/` autentica con correo y contraseña, y el menú también ofrece `Log out`. Las operaciones con sesión mantienen la protección CSRF de Django/DRF: los POST, PUT, PATCH y DELETE requieren el token CSRF. Los formularios de creación de mascotas se ocultan en el renderer para adoptantes, veterinarios y usuarios de refugio sin membresía, sin cambiar los permisos ni las respuestas de las vistas. Las pruebas cubren registro e inicio JWT anónimos mediante formularios HTML, login de sesión por correo, CSRF, visibilidad por rol y equivalencia de los estados de lectura con JWT.

**Diferencias intencionales:** se permite la diferencia de signo en enteros (signed en Django frente a `UNSIGNED` en el SQL), tal como autorizan los requisitos; el comparador normaliza esa diferencia. Se excluyen de la comparación las tablas internas de Django `django_migrations`, `django_content_type`, `django_admin_log`, `django_session`, `auth_group`, `auth_group_permissions` y `auth_permission`. Estas seis últimas tablas son necesarias para sesiones y el panel; no son tablas de negocio y no cambian las 20 tablas del modelo.

## API y autenticación

Prefijo funcional: `/api/v1/`. Autenticación JWT: registro `POST /api/v1/auth/register/`, login `POST /api/v1/auth/login/`, refresh `POST /api/v1/auth/refresh/` y perfil propio `/api/v1/auth/me/`. Swagger: `/api/docs/`.

El índice `/` presenta los recursos según la sesión y el rol, en español o inglés. El índice anónimo conserva los recursos públicos e informa, en el idioma solicitado, que debe iniciar sesión mediante el enlace `Log in` de la esquina superior derecha para ver los recursos de su rol. Para usuarios autenticados, el índice usa la tabla central `ROLE_RESOURCES`. La presentación de enlaces no concede permisos: cada endpoint conserva su propia autorización.

La matriz del índice se contrasta en tests contra el acceso HTTP real a cada recurso para adoptante, refugio, veterinario, administrador y anónimo. Los recursos listados deben responder 2xx o 405 (por ejemplo, una ruta de login consultada con GET); los no listados deben responder 401 o 403. El login y logout de sesión regresan a `/`, y los errores de credenciales/cuenta inactiva se muestran en el idioma seleccionado.

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
| `/` | `GET` | `ApiIndexView` | Público (`AllowAny`); Api Root estándar de DRF, sin redirección |
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
