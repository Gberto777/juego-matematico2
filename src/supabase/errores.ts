/*
 * Las funciones de la base de datos fallan con un código estable en el mensaje (p. ej. SALA_LLENA),
 * igual para web, móvil y Godot. Aquí se traducen a un texto para el usuario.
 * La lista completa está en docs/arquitectura.md.
 */

export const MENSAJES_ERROR: Record<string, string> = {
  // Cuenta
  USUARIO_INACTIVO: 'Tu cuenta está desactivada. Habla con el administrador.',
  SOLO_ADMIN: 'Solo un administrador puede hacer esto.',
  SOLO_DOCENTES: 'Solo los docentes pueden hacer esto.',
  NO_PUEDES_QUITARTE_ADMIN: 'No puedes quitarte el rol de administrador ni desactivar tu propia cuenta.',
  USUARIO_NO_EXISTE: 'Ese usuario no existe.',
  NOMBRE_INVALIDO: 'El nombre no es válido.',
  EMAIL_INVALIDO: 'El correo no es válido.',
  PASSWORD_INVALIDA: 'La contraseña debe tener entre 8 y 72 caracteres.',
  ROL_INVALIDO: 'El rol no es válido.',
  EMAIL_YA_EXISTE: 'Ya existe una cuenta con ese correo.',
  // Función Edge admin-crear-usuario
  NO_AUTENTICADO: 'Tu sesión caducó. Vuelve a entrar.',
  CUERPO_INVALIDO: 'Faltan datos de la cuenta.',
  NO_SE_PUDO_CREAR: 'No se pudo crear la cuenta. Inténtalo de nuevo.',
  NO_SE_PUDO_ASIGNAR_ROL: 'La cuenta se creó, pero no se pudo asignar el rol. Cámbialo desde la lista.',
  CONFIGURACION_INCOMPLETA: 'El servidor no está bien configurado. Avisa al administrador del sistema.',
  // Salas
  SALA_NO_EXISTE: 'No existe ninguna sala con ese código.',
  SALA_CERRADA: 'La sala está cerrada. Pide a tu docente un código nuevo.',
  SALA_LLENA: 'La sala está llena.',
  LIMITE_INVALIDO: 'El límite de jugadores debe estar entre 1 y 100.',
  SIN_CODIGO_LIBRE: 'No se pudo generar un código de sala. Inténtalo de nuevo.',
  SIN_ACCESO_A_SALA: 'No tienes acceso a esta sala.',
  SIN_ACCESO: 'No tienes acceso a estos datos.',
  PERIODO_INVALIDO: 'Ese periodo de ranking no existe.',
  NO_ES_MIEMBRO: 'Primero tienes que unirte a la sala.',
  // Partidas y retos
  PARTIDA_NO_EXISTE: 'No se encontró la partida.',
  PARTIDA_TERMINADA: 'Esta partida ya terminó.',
  PUNTOS_INVALIDOS: 'La puntuación no cuadra con las respuestas registradas.',
  NIVEL_INVALIDO: 'El nivel no es válido.',
  VIDAS_INVALIDAS: 'Las vidas no son válidas.',
  DATOS_INVALIDOS: 'Los datos de la partida no son válidos.',
  RETO_NO_EXISTE: 'Ese reto no existe.',
  RETO_VENCIDO: 'El plazo de este reto ya terminó.',
}

/** Errores de Supabase Auth (login, registro, contraseñas), por su `code`. */
export const MENSAJES_AUTH: Record<string, string> = {
  invalid_credentials: 'Correo o contraseña incorrectos.',
  email_not_confirmed: 'Confirma tu correo antes de entrar: revisa tu bandeja de entrada.',
  user_already_exists: 'Ya existe una cuenta con ese correo.',
  email_exists: 'Ya existe una cuenta con ese correo.',
  email_address_invalid: 'El correo no es válido.',
  weak_password: 'La contraseña es demasiado débil. Usa al menos 8 caracteres.',
  same_password: 'La nueva contraseña debe ser distinta de la anterior.',
  over_email_send_rate_limit: 'Se enviaron demasiados correos. Espera unos minutos.',
  over_request_rate_limit: 'Demasiados intentos. Espera unos minutos.',
  signup_disabled: 'El registro de cuentas está desactivado.',
  user_banned: 'Tu cuenta está bloqueada.',
  session_not_found: 'Tu sesión caducó. Vuelve a entrar.',
  session_expired: 'Tu sesión caducó. Vuelve a entrar.',
  otp_expired: 'El enlace caducó. Pide uno nuevo.',
}

interface ErrorConCodigo {
  message?: unknown
  code?: unknown
  name?: unknown
}

/** Código de MathQuest (SALA_LLENA…) dentro de un error de Supabase, o null si no lo hay. */
export function codigoDeError(error: unknown): string | null {
  const mensaje = (error as ErrorConCodigo | null)?.message
  if (typeof mensaje !== 'string') return null
  const codigo = mensaje.trim()
  return Object.hasOwn(MENSAJES_ERROR, codigo) ? codigo : null
}

/** Texto para el usuario. `porDefecto` se usa con errores inesperados (red caída, etc.). */
export function mensajeDeError(error: unknown, porDefecto = 'Algo salió mal. Inténtalo de nuevo.'): string {
  const codigo = codigoDeError(error)
  if (codigo) return MENSAJES_ERROR[codigo]
  const { code, name } = (error ?? {}) as ErrorConCodigo
  if (typeof code === 'string' && Object.hasOwn(MENSAJES_AUTH, code)) return MENSAJES_AUTH[code]
  if (code === '42501') return 'No tienes permiso para hacer esto.'
  // TypeError: fetch sin red. AuthRetryableFetchError: lo mismo dentro de Supabase Auth.
  if (error instanceof TypeError || name === 'AuthRetryableFetchError') return 'No hay conexión con el servidor.'
  return porDefecto
}
