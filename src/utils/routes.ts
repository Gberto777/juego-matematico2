import { esCodigoSalaValido, normalizarCodigoSala } from './codigoSala'
import { isValidRoomCode, normalizeRoomCode } from './room'

/**
 * Rutas de la app. Se usa el hash (#/...) para que funcione igual en GitHub Pages
 * y en Nginx sin configuración extra, y para que recargar la página conserve la pantalla.
 */
export type Route =
  /** Página informativa de MathQuest. */
  | { name: 'home' }
  /** Práctica rápida (el minijuego). */
  | { name: 'solo' }
  | { name: 'join'; code: string }
  | { name: 'classroom'; code: string }
  | { name: 'teacher' }
  | { name: 'dashboard'; code: string }
  // Cuentas (Supabase)
  | { name: 'login' }
  | { name: 'register' }
  | { name: 'forgotPassword' }
  | { name: 'resetPassword' }
  | { name: 'account' }
  | { name: 'admin' }
  | { name: 'teacherPanel' }
  // Salas (Supabase): el docente gestiona una sala; el alumno ve sus salas y juega en una.
  | { name: 'teacherRoom'; code: string }
  | { name: 'myRooms' }
  | { name: 'studentRoom'; code: string }
  // Extras: perfil, ranking y reto del día.
  | { name: 'profile' }
  | { name: 'ranking' }
  | { name: 'daily' }

/** Rutas sin parámetros: sección del hash → ruta. */
const SIMPLE_ROUTES = {
  practica: { name: 'solo' },
  entrar: { name: 'login' },
  registro: { name: 'register' },
  recuperar: { name: 'forgotPassword' },
  restablecer: { name: 'resetPassword' },
  cuenta: { name: 'account' },
  admin: { name: 'admin' },
  perfil: { name: 'profile' },
  ranking: { name: 'ranking' },
  'reto-diario': { name: 'daily' },
} as const satisfies Record<string, Route>

type SimpleRoute = (typeof SIMPLE_ROUTES)[keyof typeof SIMPLE_ROUTES]

const SIMPLE_HASHES = Object.fromEntries(
  Object.entries(SIMPLE_ROUTES).map(([section, route]) => [route.name, `#/${section}`]),
) as Record<SimpleRoute['name'], string>

/** Código de sala de Supabase leído de la URL, o null si no tiene el formato TEM-1234. */
function salaCode(raw: string): string | null {
  const code = normalizarCodigoSala(decodeURIComponent(raw))
  return esCodigoSalaValido(code) ? code : null
}

export function parseRoute(hash: string): Route {
  const [section = '', rawCode = '', rawExtra = ''] = hash.replace(/^#\/?/, '').split('/')
  const code = normalizeRoomCode(decodeURIComponent(rawCode))

  if (Object.hasOwn(SIMPLE_ROUTES, section)) {
    return SIMPLE_ROUTES[section as keyof typeof SIMPLE_ROUTES]
  }

  switch (section) {
    case 'docente': {
      const sala = rawCode === 'sala' ? salaCode(rawExtra) : null
      return sala ? { name: 'teacherRoom', code: sala } : { name: 'teacherPanel' }
    }
    case 'salas': {
      const sala = salaCode(rawCode)
      return sala ? { name: 'studentRoom', code: sala } : { name: 'myRooms' }
    }
    case 'unirse':
      return { name: 'join', code }
    case 'sala':
      return isValidRoomCode(code) ? { name: 'classroom', code } : { name: 'join', code }
    case 'profesor':
      return isValidRoomCode(code) ? { name: 'dashboard', code } : { name: 'teacher' }
    default:
      // Incluye #/ y los anclajes de la página de inicio (#descargas, #preguntas…).
      return { name: 'home' }
  }
}

export function routeToHash(route: Route): string {
  switch (route.name) {
    case 'home':
      return '#/'
    case 'join':
      return route.code ? `#/unirse/${route.code}` : '#/unirse'
    case 'classroom':
      return `#/sala/${route.code}`
    case 'teacher':
      return '#/profesor'
    case 'dashboard':
      return `#/profesor/${route.code}`
    case 'teacherPanel':
      return '#/docente'
    case 'teacherRoom':
      return `#/docente/sala/${route.code}`
    case 'myRooms':
      return '#/salas'
    case 'studentRoom':
      return `#/salas/${route.code}`
    default:
      return SIMPLE_HASHES[route.name]
  }
}
