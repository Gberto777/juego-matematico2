# Juego Matemático

React + TypeScript + Vite + TailwindCSS.

## Scripts

- `npm run dev` — servidor de desarrollo
- `npm run build` — compilación de producción
- `npm run preview` — previsualiza el build
- `npm run lint` — linter (oxlint)
- `npm test` — tests (Vitest); `npm run test:watch` en modo observación

## GitHub Pages

`vite.config.ts` usa `base: '/juego-matematico/'`, por lo que en local la app se sirve en http://localhost:5173/juego-matematico/.

```sh
npm run deploy   # compila (predeploy) y publica dist/ en la rama gh-pages
```

Requisitos: el repositorio debe llamarse `juego-matematico`, tener configurado el remoto `origin` en GitHub y, en *Settings → Pages*, usar la rama `gh-pages` como origen.

## Docker

Imagen multi-stage: compila con Node y sirve `dist/` con Nginx (Alpine). Se compila con `--base=/` para servir la app en la raíz.

```sh
docker build -t juego-matematico .
docker run --rm -p 8080:80 juego-matematico
```

La app queda en http://localhost:8080. La configuración de Nginx (`nginx.conf`) redirige cualquier ruta desconocida a `index.html` (enrutamiento SPA).

## Supabase (backend común de MathQuest)

La web, la app móvil y el juego 3D de Godot comparten un solo backend en **Supabase**. El esquema, la seguridad (RLS) y el contrato de la API están en **[docs/arquitectura.md](docs/arquitectura.md)**. La migración desde Firebase se hace por fases; mientras tanto, el modo aula descrito abajo sigue en Firebase.

| Script | Qué hace |
| --- | --- |
| `npm test` | Incluye los tests de la base de datos (`tests/db/`, PostgreSQL en memoria con PGlite, sin Docker) |
| `npm run db:start` / `db:stop` | Supabase completo en local (necesita Docker Desktop) |
| `npm run db:push` | Sube las migraciones al proyecto enlazado (`npx supabase link` antes) |
| `npm run db:functions` | Despliega la función Edge `admin-crear-usuario` |

### Página de inicio (`#/`)

Página informativa de MathQuest en "capítulos de color": cada sección tiene el color de una región del juego (bosque, cueva, volcán y la corona del castillo). En la portada se puede jugar el primer portal: tres puertas, una correcta, y cada dos aciertos el portal pasa a la región siguiente (`src/utils/portales.ts`, que imita los distractores de Godot). Secciones: regiones, dónde se juega (juego 3D, práctica web, sala de clase), así se juega, descargas, preguntas frecuentes y un formulario para entrar con el código de la sala.

Las imágenes de `public/inicio/` son capturas reales de MathQuest Runner hechas con Godot 4.7 (modelos 3D de Kenney, CC0). Para rehacerlas, abre el proyecto de Godot y ejecuta un script que cargue `res://scenes/main.tscn` con `GameState.nivel_inicial` en 1–4 y guarde `root.get_texture().get_image()`.

### Cuentas y roles

| Ruta | Pantalla | Quién |
| --- | --- | --- |
| `#/entrar` | Iniciar sesión | sin sesión |
| `#/registro` | Crear cuenta (siempre como alumno) | sin sesión |
| `#/recuperar` | Pedir el correo para cambiar la contraseña | sin sesión |
| `#/restablecer` | Elegir contraseña nueva (enlace del correo o desde «Mi cuenta») | con sesión |
| `#/cuenta` | Mi cuenta | con sesión |
| `#/docente` | Mis salas: crear (código, tema, dificultad, límite), abrir/cerrar y borrar | docente, admin |
| `#/docente/sala/MUL-4821` | Panel de la sala: código para proyectar, quién está conectado y qué hace, quitar alumnos, editar | docente, admin |
| `#/salas` | Unirme a una sala con el código y ver mis salas | con sesión |
| `#/salas/MUL-4821` | Entrar (si no estaba) y jugar en la sala o un reto del docente; ranking de la sala | con sesión |
| `#/perfil` | Mis números, reto del día, logros, dónde fallo más e historial; cambiar nombre y avatar | con sesión |
| `#/ranking` | Ranking global y de esta semana (web, app y juego 3D juntos) | con sesión |
| `#/reto-diario` | Práctica con el reto del día (igual para todos, cambia cada día) | con sesión |
| `#/admin` | Panel de administración | admin |

**Panel de administración (`#/admin`):** lista de usuarios con búsqueda (sin importar tildes) y filtros por rol y estado; crear cuentas con contraseña inicial y rol (función Edge `admin-crear-usuario`); editar nombre y rol; desactivar y reactivar (con confirmación); enviar el correo para elegir una contraseña nueva. El admin no puede quitarse su propio rol ni desactivarse (lo impide también la base de datos).

**Panel docente de cada sala:** pestañas *En vivo* (quién está conectado), *Progreso* (por alumno, fallos por operación, las cuentas más falladas y **Exportar a Excel**, con `write-excel-file` cargado solo al pulsar el botón), *Retos* (crear con tema, meta de aciertos y plazo; quién lo cumplió) y *Ranking*. El admin ve además un **resumen del sistema** en `#/admin`. Con la sesión iniciada, la práctica rápida (`#/practica`) también guarda cada partida, así cuenta para rankings y logros.

**Salas (Supabase):** cada partida en una sala se guarda con `iniciar_partida`, cada respuesta (operación y número elegido) y `actualizar_partida` (ver `src/juego/reportadorPartida.ts`), así que el panel del docente ve en vivo el nivel, los puntos y las vidas de cada alumno (Supabase Realtime, más una recarga cada 20 s). El alumno avisa de que sigue conectado cada 30 s. El tema de la sala decide el nivel con el que empieza el juego web; la dificultad se guarda para Godot y la app, pero el juego web todavía no la usa.

Si se abre una página protegida sin sesión, aparece el formulario de entrar en el mismo sitio y, al entrar, la página pedida. El rol y si la cuenta está activa se leen siempre de la tabla `usuarios`; aun así, la seguridad real la pone la base de datos (RLS): ocultar una pantalla no basta.

**Probar en local con Supabase en Docker:**

```sh
npm run db:start     # la primera vez descarga las imágenes (varios minutos)
```

Copia la `API URL` y la `Publishable key` que muestra el comando a `.env.development.local` (solo se usa con `npm run dev`; no se sube a git):

```sh
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Los correos (confirmación, recuperar contraseña) no salen a internet: se ven en Mailpit, en http://127.0.0.1:54324.

## Firebase

La persistencia y el modo aula usan **Firebase** (Authentication anónima + Cloud Firestore).

### Configuración

1. Crea un proyecto en la [consola de Firebase](https://console.firebase.google.com/) y añade una app web.
2. *Authentication → Sign-in method*: activa **Anónimo**.
3. *Authentication → Settings → Authorized domains*: añade el dominio donde publiques la app (p. ej. `<usuario>.github.io`).
4. *Firestore Database*: crea la base de datos.
5. Copia `.env.example` a `.env.local` y rellena los valores de la app web.
6. Publica las reglas de seguridad:

   ```sh
   npx firebase-tools login
   npm run deploy:rules   # usa el proyecto de .firebaserc
   ```

   Si no se publican, Firestore aplica sus reglas por defecto (denegar todo) y la app muestra
   «Missing or insufficient permissions» al crear salas, cargarlas o guardar partidas.

Sin `.env.local` la app sigue funcionando en modo individual, pero sin guardar nada y sin modo aula.

### Emuladores (desarrollo sin proyecto real)

Requiere Java 11+. En `.env.local`:

```sh
VITE_FIREBASE_PROJECT_ID=demo-juego-matematico
VITE_FIREBASE_USE_EMULATORS=true
```

```sh
npx firebase-tools emulators:start --project demo-juego-matematico   # UI en http://127.0.0.1:4000
npm run dev
```

### Modo aula

| Ruta | Pantalla |
| --- | --- |
| `#/practica` | Juego individual (práctica rápida) |
| `#/profesor` | Crear sala y ver las salas propias |
| `#/profesor/CODIGO` | Panel del profesor con los resultados en tiempo real |
| `#/unirse/CODIGO` | El alumno escribe su nombre (y el código, si no viene en el enlace) |
| `#/sala/CODIGO` | El alumno juega; cada respuesta actualiza el panel del profesor |

1. El profesor pulsa «Soy profesor» → «Crear sala» y proyecta el código de 6 caracteres (sin 0/O ni 1/I/L para evitar confusiones).
2. Cada alumno pulsa «Unirme a una clase», escribe el código y su nombre, y juega.
3. El panel muestra para cada alumno: estado (jugando / terminó / en espera), conexión, puntos, nivel y vidas de la partida actual, % de aciertos acumulado, mejor puntuación y número de partidas, con un resumen de la clase. El profesor puede cerrar la sala para que no entren más alumnos ni se envíen más resultados.

La identidad de alumnos y profesores es una sesión **anónima** de Firebase guardada en el navegador: al recargar se conserva, pero en otro navegador o dispositivo es un usuario distinto (el profesor no verá allí sus salas). Para algo más permanente se puede añadir inicio de sesión con Google al profesor sin cambiar el modelo de datos.

### Modelo de datos

```
users/{uid}                      { records: { highScore, maxLevel }, studentName }
users/{uid}/saves/{slot}         { state: GameState }   slot = "solo" | "sala-CODIGO"
rooms/{CODIGO}                   { name, teacherId, status: "open" | "closed", createdAt }
rooms/{CODIGO}/players/{uid}     { name, status, score, level, lives, totalCorrect, totalAnswered,
                                   gamesPlayed, bestScore, bestLevel, correctAllGames, answeredAllGames,
                                   joinedAt, updatedAt }
```

Las reglas (`firestore.rules`) garantizan que cada alumno solo escribe su propio documento y solo mientras la sala está abierta, que solo el profesor de la sala puede leer los resultados de todos, y que nadie puede listar salas ajenas. Validan tipos y rangos, pero las métricas las calcula el navegador del alumno: un alumno con conocimientos técnicos podría enviar puntuaciones falsas dentro de esos rangos.

Firestore usa caché persistente: si la wifi del aula falla, el juego sigue y las escrituras se envían al reconectar. La partida en curso se guarda en cada respuesta y se recupera al recargar; los datos leídos se validan y, si están corruptos, se ignoran.

## Estructura

```
src/
  components/  componentes de UI (juego, unirse a sala, panel del profesor…)
  firebase/    inicialización de Firebase, repositorio de partidas y operaciones de salas
  supabase/    cliente de Supabase, tipos de la base de datos y mensajes de error
  hooks/       hooks personalizados (lógica del juego, rutas, suscripciones en tiempo real)
  utils/       lógica pura y testeable (juego, validación, códigos de sala, rutas)
  App.tsx
  main.tsx
  index.css    entrada de Tailwind
supabase/
  migrations/  esquema SQL, políticas RLS y funciones RPC
  functions/   funciones Edge (Deno)
tests/db/      tests de la base de datos con PGlite
docs/          arquitectura y contrato de la API
```
