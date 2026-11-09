/*
 * Validación de los formularios de cuenta en el navegador, para avisar antes de enviar.
 * Los límites coinciden con la base de datos (nombre 1–40) y con Supabase Auth (contraseña ≥ 8).
 */

export const NOMBRE_MAX = 40
export const PASSWORD_MIN = 8
export const PASSWORD_MAX = 72

const PATRON_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function normalizarEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function normalizarNombre(nombre: string): string {
  return nombre.trim().replace(/\s+/g, ' ')
}

export function errorEmail(email: string): string | null {
  const limpio = normalizarEmail(email)
  if (!limpio) return 'Escribe tu correo.'
  return PATRON_EMAIL.test(limpio) ? null : 'El correo no parece válido (ejemplo: ana@colegio.edu).'
}

export function errorPassword(password: string): string | null {
  if (password.length < PASSWORD_MIN) return `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres.`
  if (password.length > PASSWORD_MAX) return `La contraseña puede tener como máximo ${PASSWORD_MAX} caracteres.`
  return null
}

export function errorNombre(nombre: string): string | null {
  const limpio = normalizarNombre(nombre)
  if (!limpio) return 'Escribe tu nombre.'
  return limpio.length > NOMBRE_MAX ? `El nombre puede tener como máximo ${NOMBRE_MAX} caracteres.` : null
}

export function errorConfirmacion(password: string, confirmacion: string): string | null {
  return password === confirmacion ? null : 'Las contraseñas no coinciden.'
}

/** Primer error de una lista de comprobaciones, o null si todo está bien. */
export function primerError(...errores: (string | null)[]): string | null {
  return errores.find((e) => e !== null) ?? null
}
