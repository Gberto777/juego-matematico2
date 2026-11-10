# MathQuest · Arquitectura del backend común

Un solo backend en **Supabase** (PostgreSQL + Auth + API REST + Realtime) que usan los tres proyectos:

| Proyecto | Tecnología | Cómo habla con Supabase |
| --- | --- | --- |
| Web (`juego-matematico2`) | React + Vite | `@supabase/supabase-js` |
| App móvil (`juego-matematico-movil`) | Expo / React Native | `@supabase/supabase-js` |
| Juego 3D (`mathquest`) | Godot 4.7 | `HTTPRequest` contra la API REST (JSON) |

La fuente de verdad del esquema son las migraciones de [`supabase/migrations/`](../supabase/migrations). Este documento las explica y fija el **contrato**: si algo cambia aquí, cambia para los tres.

## Decisiones importantes (en simple)

- **Cuentas reales con correo y contraseña.** Sustituyen a la sesión anónima de Firebase: el progreso sigue al alumno en cualquier dispositivo. Registro, inicio de sesión y recuperación de contraseña los da Supabase Auth.
- **Roles `admin`, `docente` y `alumno`** en la tabla `usuarios`. Toda cuenta nueva es `alumno`; solo un admin cambia roles. El admin puede hacer todo lo que hace un docente.
- **La base de datos se protege sola (RLS).** Igual que las reglas de Firestore: cada consulta se filtra según quién la hace. Un alumno no puede leer partidas ajenas aunque modifique la app.
- **Los aciertos los cuenta el servidor.** El cliente envía cada operación con la respuesta dada (`3 + 4 → 7`) y PostgreSQL decide si es correcta. Los puntos se aceptan solo si cuadran con esos aciertos. Así es mucho más difícil hacer trampa que con Firestore, donde el navegador mandaba las métricas.
- **Lo delicado pasa por funciones RPC** (`crear_sala`, `unirse_sala`, `actualizar_partida`…), que validan en el servidor. Leer datos se hace con consultas normales a las tablas.
- **"Conectado" = actividad en los últimos 2 minutos.** Cada respuesta cuenta como actividad y, si el jugador está en un menú, se envía un *latido* cada ~30 s. Funciona igual en Godot (que no usa Realtime) que en la web.
- **Códigos de sala `TEM-1234`**: prefijo según el tema (`SUM`, `RES`, `MUL`, `MIX`) y 4 cifras, p. ej. `MUL-4821`. Fáciles de dictar en clase. Se aceptan sin guion y en minúsculas.
- **Avatares predefinidos** (un identificador como `buho` o `zorro`), sin subir imágenes: más simple y seguro con menores de edad.

## Esquema

```
auth.users ─1:1─ usuarios ─1:N─ salas (docente_id) ─1:N─ retos
                    │              │
                    │              └─N:M─ sala_miembros ─ usuarios (alumnos)
                    │
                    ├─1:N─ partidas ─1:N─ respuestas
                    │        └── sala_id?, reto_id?
                    └─N:M─ usuario_logros ─ logros
```

| Tabla | Para qué | Columnas principales |
| --- | --- | --- |
| `usuarios` | Perfil de cada cuenta | `id` (= `auth.users.id`), `email`, `nombre`, `rol`, `avatar`, `activo`, `creado_en` |
| `salas` | Salas de clase | `codigo` (único), `nombre`, `docente_id`, `tema`, `dificultad`, `max_jugadores` (1–100), `estado` (`abierta`/`cerrada`), `cerrada_en` |
| `sala_miembros` | Alumnos de cada sala | `sala_id`, `usuario_id`, `unido_en`, `ultima_actividad` |
| `retos` | Tareas del docente para una sala | `sala_id`, `titulo`, `descripcion`, `tema`, `dificultad`, `meta_aciertos`, `fecha_limite` |
| `partidas` | Una partida jugada | `usuario_id`, `sala_id?`, `reto_id?`, `origen` (`web`/`movil`/`godot`), `modo` (`practica`/`sala`/`reto`/`diario`), `estado` (`en_curso`/`terminada`/`abandonada`), `nivel_inicial`, `nivel`, `puntos`, `vidas`, `aciertos`\*, `respuestas_total`\*, `monedas`, `jefe_derrotado`, `duracion_seg` |
| `respuestas` | Cada operación respondida | `partida_id`, `operacion` (`suma`/`resta`/`multiplicacion`), `a`, `b`, `respuesta`, `resultado`\*, `correcta`\*, `tiempo_ms` |
| `logros` | Catálogo de logros | `id`, `nombre`, `descripcion`, `icono` |
| `usuario_logros` | Logros conseguidos | `usuario_id`, `logro_id`, `obtenido_en` |

\* Calculado por la base de datos; el cliente no lo puede escribir.

**Valores comunes**

- Niveles: `1` sumas, `2` restas, `3` multiplicar, `4` mixtas (igual en la web y en Godot; en Godot cada nivel es una región: bosque, cueva, volcán, castillo).
- Temas: `suma`, `resta`, `multiplicacion`, `mixta`. Dificultades: `facil`, `media`, `dificil`.
- Avatares: `buho`, `zorro`, `gato`, `perro`, `panda`, `leon`, `rana`, `pulpo`, `robot`, `dragon` (cualquier identificador `[a-z0-9_]` es válido para la base de datos; esta es la lista que muestran las apps).
- Logros: `primera_partida`, `en_clase`, `nivel_mixtas`, `diez_partidas`, `cien_aciertos`, `precision_90`, `quinientos_puntos`, `reto_cumplido`, `rey_derrotado`.

### Quién ve y hace qué

| | Alumno | Docente | Admin |
| --- | --- | --- | --- |
| Su perfil (nombre, avatar) | ver / editar | ver / editar | ver / editar |
| Otros perfiles | — | los alumnos de sus salas | todos; cambia rol, nombre y activo |
| Salas | las suyas (tras unirse) | crea, edita, abre/cierra, borra las suyas, expulsa | todas |
| Retos | ve los de sus salas | crea / edita / borra en sus salas | todos |
| Partidas y respuestas | las suyas | las jugadas en sus salas | todas |
| Logros | los suyos | los de sus alumnos | todos |

Un usuario **desactivado** solo puede leer su perfil (para que la app le avise) y no puede hacer nada más.

## Contrato de la API

Todas las peticiones llevan las cabeceras:

```
apikey: <clave pública>
Authorization: Bearer <access_token>      (salvo login y registro)
Content-Type: application/json
```

`<URL>` es la URL del proyecto (`https://xxxx.supabase.co`). La web y la móvil usan supabase-js, que hace esto por debajo; los ejemplos en HTTP son los que usará Godot.

### Autenticación (Supabase Auth)

| Acción | Petición | Notas |
| --- | --- | --- |
| Registro | `POST <URL>/auth/v1/signup` `{ "email", "password", "data": { "nombre": "Ana" } }` | Crea un `alumno`. Si la confirmación de correo está activa, hay que confirmar antes de entrar. |
| Iniciar sesión | `POST <URL>/auth/v1/token?grant_type=password` `{ "email", "password" }` | Devuelve `access_token` (1 h), `refresh_token`, `expires_in`, `user.id`. |
| Renovar sesión | `POST <URL>/auth/v1/token?grant_type=refresh_token` `{ "refresh_token" }` | Hacerlo antes de que caduque el `access_token`. |
| Recuperar contraseña | `POST <URL>/auth/v1/recover` `{ "email" }` | Envía un correo con un enlace a la web (`#/restablecer`). |
| Cerrar sesión | `POST <URL>/auth/v1/logout` | |

Después de iniciar sesión, cada app lee el perfil y **comprueba `activo`**:

```
GET <URL>/rest/v1/usuarios?id=eq.<user.id>&select=*
Accept: application/vnd.pgrst.object+json        (devuelve un objeto en vez de una lista)
```

### Funciones RPC

`POST <URL>/rest/v1/rpc/<nombre>` con los parámetros por nombre en el cuerpo JSON.

| Función | Parámetros | Devuelve | Quién |
| --- | --- | --- | --- |
| `crear_sala` | `p_nombre`, `p_tema`=`mixta`, `p_dificultad`=`media`, `p_max_jugadores`=30 | sala | docente, admin |
| `unirse_sala` | `p_codigo` | sala | cualquiera activo |
| `latido_sala` | `p_sala_id` | `"abierta"` / `"cerrada"` / `null` (no eres miembro) | miembro |
| `miembros_sala` | `p_sala_id` | lista: `usuario_id`, `nombre`, `avatar`, `conectado`, `jugando`, `puntos`, `nivel`, `vidas` (de la partida en curso), `partidas_terminadas`, `mejor_puntos`, `unido_en`, `ultima_actividad` | docente de la sala, admin, miembros |
| `iniciar_partida` | `p_origen`, `p_modo`=`practica`, `p_nivel_inicial`=1, `p_sala_id`?, `p_reto_id`? | partida | cualquiera activo |
| `actualizar_partida` | `p_partida_id`, `p_puntos`, `p_nivel`, `p_vidas`, `p_monedas`=0, `p_duracion_seg`=0, `p_jefe_derrotado`=false, `p_terminar`=false | `{ "partida": {...}, "logros_nuevos": [{ id, nombre, descripcion, icono }] }` | dueño de la partida |
| `admin_actualizar_usuario` | `p_id`, `p_nombre`?, `p_rol`?, `p_activo`? (los nulos no cambian) | usuario | admin |

Crear cuentas desde el panel de admin usa la **función Edge** `POST <URL>/functions/v1/admin-crear-usuario` con `{ "email", "password", "nombre", "rol" }` → `201 { "usuario": {...} }`. Necesita la clave secreta, por eso no puede ser una RPC normal.

### Tablas (lectura y escritura directa)

| Acción | Petición |
| --- | --- |
| Mi perfil | `GET /rest/v1/usuarios?id=eq.<uid>` |
| Cambiar nombre o avatar | `PATCH /rest/v1/usuarios?id=eq.<uid>` `{ "nombre": "Ana", "avatar": "zorro" }` |
| Lista de usuarios (admin) | `GET /rest/v1/usuarios?select=*&order=creado_en.desc&rol=eq.docente` |
| Mis salas (docente) / mis salas (alumno) | `GET /rest/v1/salas?select=*&order=creado_en.desc` (RLS ya filtra) |
| Abrir / cerrar / editar sala | `PATCH /rest/v1/salas?id=eq.<id>` `{ "estado": "cerrada" }` |
| Expulsar alumno / salir de la sala | `DELETE /rest/v1/sala_miembros?sala_id=eq.<id>&usuario_id=eq.<uid>` |
| Crear reto | `POST /rest/v1/retos` `{ "sala_id", "titulo", "tema", "dificultad", "meta_aciertos", "fecha_limite" }` |
| Retos de mis salas | `GET /rest/v1/retos?select=*,salas(nombre,codigo)` |
| **Enviar respuestas** | `POST /rest/v1/respuestas` con un objeto o una lista `[{ "partida_id", "operacion", "a", "b", "respuesta", "tiempo_ms" }]` + `Prefer: return=minimal` |
| Mi historial | `GET /rest/v1/partidas?usuario_id=eq.<uid>&estado=eq.terminada&order=terminada_en.desc&limit=20` |
| Mis logros | `GET /rest/v1/usuario_logros?select=obtenido_en,logros(*)` |

### Flujo de una partida (igual en los tres clientes)

1. `iniciar_partida` → guarda `partida.id`. Si había otra partida en curso **del mismo origen**, queda `abandonada`.
2. Cada vez que el jugador responde → `POST /rest/v1/respuestas`. En Godot cada portal es una respuesta: `a`, `b` y `operacion` salen de `MathGenerator.Operacion`, y `respuesta` es el número del portal elegido. Si no hay red, se guardan en una cola y se envían por lotes al volver.
3. De vez en cuando (al subir de nivel, por ejemplo) → `actualizar_partida` con los puntos, nivel y vidas actuales, para que el docente lo vea en vivo.
4. Al terminar → **primero** se envían las respuestas pendientes y **después** `actualizar_partida` con `p_terminar: true`. Mostrar `logros_nuevos` si los hay.

Los puntos se validan así: `puntos ≤ aciertos × 40 + 100`. Es el máximo de la web (10 × nivel por acierto) más margen para el bonus del jefe en Godot (+50).

### Tiempo real (web y móvil)

El panel del docente se suscribe con supabase-js a los cambios de `salas`, `sala_miembros` y `partidas` filtrando por `sala_id`. Con cada aviso vuelve a pedir `miembros_sala`. Realtime respeta RLS: cada uno solo recibe lo que puede ver. Godot no lo necesita: el estado de la sala lo obtiene con `latido_sala`.

### Errores

Los errores de las RPC llegan como `{ "code": "P0001", "message": "SALA_LLENA" }` (HTTP 400), o con `code` `42501` (HTTP 403) si falta permiso. El `message` es un código estable que cada app traduce (la web lo hace en [`src/supabase/errores.ts`](../src/supabase/errores.ts)).

| Código | Significado |
| --- | --- |
| `USUARIO_INACTIVO` | La cuenta está desactivada |
| `SOLO_ADMIN`, `SOLO_DOCENTES` | Falta el rol necesario |
| `NO_PUEDES_QUITARTE_ADMIN` | El admin intentó quitarse el rol o desactivarse |
| `USUARIO_NO_EXISTE`, `NOMBRE_INVALIDO` | Administración de usuarios |
| `SALA_NO_EXISTE`, `SALA_CERRADA`, `SALA_LLENA` | Al unirse o jugar en una sala |
| `LIMITE_INVALIDO`, `SIN_CODIGO_LIBRE` | Al crear una sala |
| `SIN_ACCESO_A_SALA`, `NO_ES_MIEMBRO` | La sala no es tuya |
| `NIVEL_INVALIDO`, `VIDAS_INVALIDAS`, `PUNTOS_INVALIDOS`, `DATOS_INVALIDOS` | Datos de partida fuera de rango |
| `PARTIDA_NO_EXISTE`, `PARTIDA_TERMINADA` | La partida no es tuya o ya terminó |
| `RETO_NO_EXISTE`, `RETO_VENCIDO` | Retos |
| `ORIGEN_REQUERIDO`, `SALA_REQUERIDA`, `RETO_REQUERIDO`, `DEMASIADAS_RESPUESTAS` | Error de programación del cliente |

Función Edge `admin-crear-usuario`: `NO_AUTENTICADO` (401), `SOLO_ADMIN` (403), `CUERPO_INVALIDO`, `EMAIL_INVALIDO`, `PASSWORD_INVALIDA`, `NOMBRE_INVALIDO`, `ROL_INVALIDO` (400), `EMAIL_YA_EXISTE` (409).

### Rankings, estadísticas y retos (migración `20261110000000_extras.sql`)

Funciones de solo lectura: agregan los datos en el servidor y devuelven lo justo, así nadie necesita leer partidas ajenas para ver un ranking.

| Función | Parámetros | Devuelve | Quién |
| --- | --- | --- | --- |
| `ranking` | `p_periodo` = `global` o `semanal` (desde el lunes), `p_sala_id`?, `p_limite`=20 (máx. 100) | lista: `posicion`, `usuario_id`, `nombre`, `avatar`, `mejor_puntos`, `partidas`, `es_yo` | cualquiera activo; con sala, solo quien la ve |
| `estadisticas_sala` | `p_sala_id` | por alumno: `partidas`, `aciertos`, `respuestas`, `porcentaje_aciertos`, `mejor_puntos`, `nivel_max`, `ultima_partida` | docente de la sala, admin |
| `errores_por_operacion` | `p_sala_id`?, `p_usuario_id`? (sin nada: los propios) | por operación: `respuestas`, `fallos`, `porcentaje_fallo` | sala: su docente; usuario: él mismo o admin |
| `operaciones_dificiles` | igual que la anterior + `p_limite`=10, `p_minimo`=2 intentos | las cuentas más falladas: `operacion`, `a`, `b`, `resultado`, `intentos`, `fallos` | igual |
| `estadisticas_usuario` | `p_usuario_id`? | `{ partidas, puntos_max, nivel_max, aciertos, respuestas, precision, monedas, jefe_derrotado, minutos_jugados, por_origen: { web, movil, godot }, ultimas: [10 partidas] }` | él mismo, admin, sus docentes |
| `estadisticas_sistema` | — | `{ usuarios, salas, partidas, respuestas, por_dia: [14 días] }` | admin |
| `retos_sala` | `p_sala_id` | retos con `cumplidos`, `miembros`, `mi_mejor`, `cumplido_por_mi` | docente, admin, miembros |
| `progreso_reto` | `p_reto_id` | por alumno: `mejor_aciertos`, `intentos`, `cumplido` | docente de la sala, admin |
| `reto_diario` | `p_fecha`? (hoy) | `{ fecha, tema, dificultad, meta_aciertos, mi_mejor, completado }` | cualquiera activo |

- **Un reto se cumple** con una partida terminada con `p_reto_id` que llegue a `meta_aciertos`.
- **El reto del día** es igual para todos y cambia cada día. Se juega con `iniciar_partida(p_modo => 'diario')` y se cumple con una partida terminada ese día que llegue a la meta.
- Errores nuevos: `PERIODO_INVALIDO`, `SIN_ACCESO`.

## Puesta en marcha

1. Crea un proyecto en [supabase.com](https://supabase.com) (plan gratuito). Copia la **URL** y la **clave pública** a `.env.local` (ver `.env.example`).
2. Enlaza el repositorio y sube el esquema:

   ```sh
   npx supabase login
   npx supabase link --project-ref <ref-del-proyecto>
   npx supabase db push
   npx supabase functions deploy admin-crear-usuario
   ```

3. *Authentication → URL Configuration*: pon como *Site URL* `https://gberto777.github.io/juego-matematico2/` y añade `http://localhost:5173/juego-matematico2/**` a las *Redirect URLs*.
4. Regístrate en la web y conviértete en el primer admin desde *SQL Editor*:

   ```sql
   update public.usuarios set rol = 'admin' where email = 'tu-correo@ejemplo.com';
   ```

> El plan gratuito **pausa el proyecto tras 7 días sin uso**. Se reactiva desde el panel.

### Desarrollo y pruebas

- `npm test` ejecuta también los tests de la base de datos (`tests/db/`). Usan **PGlite**, un PostgreSQL que corre dentro de Node: aplican las migraciones reales y prueban las políticas como si fueran cada rol. No necesitan Docker ni conexión.
- Con Docker Desktop encendido, `npx supabase start` levanta Supabase completo en local (API en `http://127.0.0.1:54321`, panel en `http://127.0.0.1:54323`).
- Al crear una migración nueva: las tablas nuevas **no** tienen permisos para `authenticated` (así se configuró a propósito). Hay que concederlos explícitamente y activar RLS.

## Migración desde Firebase

Hoy la web y la móvil comparten Firestore (`users`, `rooms/{code}/players`) con sesión anónima. El plan:

1. La web pasa a Supabase por fases (auth → usuarios → salas → página → extras). El modo aula de Firebase sigue funcionando hasta que las salas de Supabase lo sustituyan.
2. La app móvil cambia `src/firebase/*` por el cliente de Supabase con este mismo contrato.
3. Godot añade un autoload `Api` con `HTTPRequest` (login, `iniciar_partida`, `respuestas`, `actualizar_partida`, `unirse_sala`, `latido_sala`) y conserva `SaveData` como caché local sin conexión.
4. Cuando las tres apps usan Supabase, se borran Firebase y sus reglas. Los datos de Firestore no se copian: eran usuarios anónimos que no se pueden asociar a cuentas reales.
