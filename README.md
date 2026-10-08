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
   npx firebase-tools deploy --only firestore:rules --project <id-del-proyecto>
   ```

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
| `#/` | Juego individual |
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
  hooks/       hooks personalizados (lógica del juego, rutas, suscripciones en tiempo real)
  utils/       lógica pura y testeable (juego, validación, códigos de sala, rutas)
  App.tsx
  main.tsx
  index.css    entrada de Tailwind
```
