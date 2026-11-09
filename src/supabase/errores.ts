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
  // Salas
  SALA_NO_EXISTE: 'No existe ninguna sala con ese código.',
  SALA_CERRADA: 'La sala está cerrada. Pide a tu docente un código nuevo.',
  SALA_LLENA: 'La sala está llena.',
  LIMITE_INVALIDO: 'El límite de jugadores debe estar entre 1 y 100.',
  SIN_CODIGO_LIBRE: 'No se pudo generar un código de sala. Inténtalo de nuevo.',
  SIN_ACCESO_A_SALA: 'No tienes acceso a esta sala.',
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

interface ErrorConCodigo {
  message?: unknown
  code?: unknown
}

/** Código de MathQuest (SALA_LLENA…) dentro de un error de Supabase, o null si no lo hay. */
export function codigoDeError(error: unknown): string | null {
  const mensaje = (error as ErrorConCodigo | null)?.message
  if (typeof mensaje !== 'string') return null
  const codigo = mensaje.trim()
  return codigo in MENSAJES_ERROR ? codigo : null
}

/** Texto para el usuario. `porDefecto` se usa con errores inesperados (red caída, etc.). */
export function mensajeDeError(error: unknown, porDefecto = 'Algo salió mal. Inténtalo de nuevo.'): string {
  const codigo = codigoDeError(error)
  if (codigo) return MENSAJES_ERROR[codigo]
  if ((error as ErrorConCodigo | null)?.code === '42501') return 'No tienes permiso para hacer esto.'
  if (error instanceof TypeError) return 'No hay conexión con el servidor.'
  return porDefecto
}
