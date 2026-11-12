import type { DatosSala } from '../supabase/servicioSalas'
import type { Dificultad, TemaOperacion } from '../supabase/tipos'
import type { Level } from './mathUtils'

/*
 * Códigos de las salas de Supabase: prefijo según el tema + 4 cifras, p. ej. MUL-4821.
 * (Las salas antiguas de Firebase usan otro formato: utils/room.ts.)
 */

const PATRON = /^[A-Z]{3}-\d{4}$/

/** Acepta "mul4821", "MUL 4821" o "mul-4821" y devuelve "MUL-4821" (o lo que se pueda). */
export function normalizarCodigoSala(entrada: string): string {
  const limpio = entrada.toUpperCase().replace(/[^A-Z0-9]/g, '')
  return /^[A-Z]{3}\d+$/.test(limpio) ? `${limpio.slice(0, 3)}-${limpio.slice(3, 7)}` : limpio.slice(0, 8)
}

export function esCodigoSalaValido(codigo: string): boolean {
  return PATRON.test(codigo)
}

export const NOMBRE_TEMA: Record<TemaOperacion, string> = {
  suma: 'Sumas',
  resta: 'Restas',
  multiplicacion: 'Multiplicar',
  mixta: 'Mixtas',
}

export const ICONO_TEMA: Record<TemaOperacion, string> = {
  suma: '➕',
  resta: '➖',
  multiplicacion: '✖️',
  mixta: '🔀',
}

export const NOMBRE_DIFICULTAD: Record<Dificultad, string> = {
  facil: 'Fácil',
  media: 'Media',
  dificil: 'Difícil',
}

/** Mismos límites que la base de datos (crear_sala). */
export const MAX_JUGADORES_LIMITE = 100
export const NOMBRE_SALA_MAX = 60

export function validarDatosSala(datos: DatosSala): string | null {
  const nombre = datos.nombre.trim()
  if (!nombre) return 'Ponle un nombre a la sala (por ejemplo, «4.º B»).'
  if (nombre.length > NOMBRE_SALA_MAX) return `El nombre puede tener como máximo ${NOMBRE_SALA_MAX} caracteres.`
  if (!Number.isInteger(datos.max_jugadores) || datos.max_jugadores < 1 || datos.max_jugadores > MAX_JUGADORES_LIMITE) {
    return `El límite de jugadores debe estar entre 1 y ${MAX_JUGADORES_LIMITE}.`
  }
  return null
}

/** "hace 3 min", "hace 2 h"… para la última actividad de un alumno. */
export function haceCuanto(fecha: string, ahora: number = Date.now()): string {
  const segundos = Math.max(0, Math.round((ahora - new Date(fecha).getTime()) / 1000))
  if (segundos < 60) return 'ahora mismo'
  const minutos = Math.round(segundos / 60)
  if (minutos < 60) return `hace ${minutos} min`
  const horas = Math.round(minutos / 60)
  if (horas < 24) return `hace ${horas} h`
  const dias = Math.round(horas / 24)
  return dias === 1 ? 'hace 1 día' : `hace ${dias} días`
}

/**
 * Nivel con el que empieza el juego web en una sala según su tema. "Mixtas" empieza en sumas
 * y avanza como siempre; el resto empieza directamente en su operación.
 */
export function nivelInicialDeTema(tema: TemaOperacion): Level {
  switch (tema) {
    case 'resta':
      return 2
    case 'multiplicacion':
      return 3
    default:
      return 1
  }
}
