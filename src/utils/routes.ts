import { isValidRoomCode, normalizeRoomCode } from './room'

/**
 * Rutas de la app. Se usa el hash (#/...) para que funcione igual en GitHub Pages
 * y en Nginx sin configuración extra, y para que recargar la página conserve la pantalla.
 */
export type Route =
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

/** Rutas sin parámetros: sección del hash → ruta. */
const SIMPLE_ROUTES = {
  entrar: { name: 'login' },
  registro: { name: 'register' },
  recuperar: { name: 'forgotPassword' },
  restablecer: { name: 'resetPassword' },
  cuenta: { name: 'account' },
  admin: { name: 'admin' },
  docente: { name: 'teacherPanel' },
} as const satisfies Record<string, Route>

type SimpleRoute = (typeof SIMPLE_ROUTES)[keyof typeof SIMPLE_ROUTES]

const SIMPLE_HASHES = Object.fromEntries(
  Object.entries(SIMPLE_ROUTES).map(([section, route]) => [route.name, `#/${section}`]),
) as Record<SimpleRoute['name'], string>

export function parseRoute(hash: string): Route {
  const [section = '', rawCode = ''] = hash.replace(/^#\/?/, '').split('/')
  const code = normalizeRoomCode(decodeURIComponent(rawCode))

  if (Object.hasOwn(SIMPLE_ROUTES, section)) {
    return SIMPLE_ROUTES[section as keyof typeof SIMPLE_ROUTES]
  }

  switch (section) {
    case 'unirse':
      return { name: 'join', code }
    case 'sala':
      return isValidRoomCode(code) ? { name: 'classroom', code } : { name: 'join', code }
    case 'profesor':
      return isValidRoomCode(code) ? { name: 'dashboard', code } : { name: 'teacher' }
    default:
      return { name: 'solo' }
  }
}

export function routeToHash(route: Route): string {
  switch (route.name) {
    case 'solo':
      return '#/'
    case 'join':
      return route.code ? `#/unirse/${route.code}` : '#/unirse'
    case 'classroom':
      return `#/sala/${route.code}`
    case 'teacher':
      return '#/profesor'
    case 'dashboard':
      return `#/profesor/${route.code}`
    default:
      return SIMPLE_HASHES[route.name]
  }
}
