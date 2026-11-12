/**
 * Validación del cuerpo de la petición de admin-crear-usuario.
 * Sin dependencias (ni de Deno ni de Node) para poder probarla con Vitest.
 */

export const ROLES = ['admin', 'docente', 'alumno'] as const
export type Rol = (typeof ROLES)[number]

export interface NuevoUsuario {
  email: string
  password: string
  nombre: string
  rol: Rol
}

export type ResultadoValidacion = { ok: true; datos: NuevoUsuario } | { ok: false; error: string }

const PATRON_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const PASSWORD_MIN = 8
// bcrypt, que usa Supabase Auth, ignora lo que pasa de 72 bytes.
export const PASSWORD_MAX = 72
export const NOMBRE_MAX = 40

export function validarNuevoUsuario(cuerpo: unknown): ResultadoValidacion {
  if (typeof cuerpo !== 'object' || cuerpo === null) return { ok: false, error: 'CUERPO_INVALIDO' }
  const { email, password, nombre, rol } = cuerpo as Record<string, unknown>

  if (typeof email !== 'string' || email.length > 254 || !PATRON_EMAIL.test(email.trim())) {
    return { ok: false, error: 'EMAIL_INVALIDO' }
  }
  if (typeof password !== 'string' || password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) {
    return { ok: false, error: 'PASSWORD_INVALIDA' }
  }
  const nombreLimpio = typeof nombre === 'string' ? nombre.trim().replace(/\s+/g, ' ') : ''
  if (nombreLimpio.length < 1 || nombreLimpio.length > NOMBRE_MAX) {
    return { ok: false, error: 'NOMBRE_INVALIDO' }
  }
  const rolFinal = rol ?? 'alumno'
  if (typeof rolFinal !== 'string' || !(ROLES as readonly string[]).includes(rolFinal)) {
    return { ok: false, error: 'ROL_INVALIDO' }
  }

  return {
    ok: true,
    datos: { email: email.trim().toLowerCase(), password, nombre: nombreLimpio, rol: rolFinal as Rol },
  }
}

export const CABECERAS_CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
