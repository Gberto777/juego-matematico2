import type { Rol, Usuario } from '../supabase/tipos'
import type { Route } from './routes'

/**
 * Quién puede ver cada pantalla de cuentas. Es solo para la interfaz: aunque alguien se salte
 * esta comprobación, la base de datos (RLS) no le devolverá datos que no le corresponden.
 */
export type Requisito = 'publico' | 'sin-sesion' | 'sesion' | readonly Rol[]

/** Rutas de Supabase. Las del juego y del modo aula de Firebase no dependen de esto. */
export function requisitoDe(route: Route): Requisito {
  switch (route.name) {
    case 'login':
    case 'register':
    case 'forgotPassword':
      return 'sin-sesion'
    case 'resetPassword':
    case 'account':
    case 'myRooms':
    case 'studentRoom':
    case 'profile':
    case 'ranking':
    case 'daily':
      return 'sesion'
    case 'admin':
      return ['admin']
    case 'teacherPanel':
    case 'teacherRoom':
      return ['docente', 'admin']
    default:
      return 'publico'
  }
}

export type EstadoAuth =
  /** No hay Supabase configurado (falta .env.local): las cuentas no están disponibles. */
  | { estado: 'desactivado' }
  | { estado: 'cargando' }
  | { estado: 'anonimo' }
  | { estado: 'sesion'; usuario: Usuario }
  | { estado: 'error'; error: Error }

export type Acceso =
  | 'permitido'
  /** Pantalla de entrar/registrarse con la sesión ya iniciada: se manda a "Mi cuenta". */
  | 'ya-con-sesion'
  | 'cargando'
  | 'pedir-login'
  | 'prohibido'
  | 'inactivo'
  | 'no-disponible'
  | 'error'

export function evaluarAcceso(requisito: Requisito, auth: EstadoAuth): Acceso {
  if (requisito === 'publico') return 'permitido'

  switch (auth.estado) {
    case 'desactivado':
      return 'no-disponible'
    case 'cargando':
      return 'cargando'
    case 'error':
      return 'error'
    case 'anonimo':
      return requisito === 'sin-sesion' ? 'permitido' : 'pedir-login'
    case 'sesion':
      if (requisito === 'sin-sesion') return 'ya-con-sesion'
      if (!auth.usuario.activo) return 'inactivo'
      if (requisito === 'sesion') return 'permitido'
      return requisito.includes(auth.usuario.rol) ? 'permitido' : 'prohibido'
  }
}

export const NOMBRE_ROL: Record<Rol, string> = {
  admin: 'Administrador',
  docente: 'Docente',
  alumno: 'Alumno',
}
