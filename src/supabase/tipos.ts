/*
 * Tipos de las tablas y funciones de Supabase (ver supabase/migrations y docs/arquitectura.md).
 * Escritos a mano mientras no haya un proyecto enlazado; cuando lo haya se pueden generar con
 * `npx supabase gen types typescript --linked`.
 */

export type Rol = 'admin' | 'docente' | 'alumno'
export type TemaOperacion = 'suma' | 'resta' | 'multiplicacion' | 'mixta'
export type Dificultad = 'facil' | 'media' | 'dificil'
export type EstadoSala = 'abierta' | 'cerrada'
export type OrigenPartida = 'web' | 'movil' | 'godot'
export type ModoPartida = 'practica' | 'sala' | 'reto' | 'diario'
export type EstadoPartida = 'en_curso' | 'terminada' | 'abandonada'
export type Operacion = 'suma' | 'resta' | 'multiplicacion'

/** Las fechas llegan de la API como texto ISO 8601. */
type Fecha = string

export interface Usuario {
  id: string
  email: string
  nombre: string
  rol: Rol
  avatar: string
  activo: boolean
  creado_en: Fecha
  actualizado_en: Fecha
}

export interface Sala {
  id: string
  codigo: string
  nombre: string
  docente_id: string
  tema: TemaOperacion
  dificultad: Dificultad
  max_jugadores: number
  estado: EstadoSala
  creado_en: Fecha
  cerrada_en: Fecha | null
}

export interface MiembroSala {
  usuario_id: string
  nombre: string
  avatar: string
  unido_en: Fecha
  ultima_actividad: Fecha
  conectado: boolean
  jugando: boolean
  puntos: number | null
  nivel: number | null
  vidas: number | null
  partidas_terminadas: number
  mejor_puntos: number
}

export interface Reto {
  id: string
  sala_id: string
  docente_id: string
  titulo: string
  descripcion: string
  tema: TemaOperacion
  dificultad: Dificultad
  meta_aciertos: number
  fecha_limite: Fecha | null
  creado_en: Fecha
}

export interface Partida {
  id: string
  usuario_id: string
  sala_id: string | null
  reto_id: string | null
  origen: OrigenPartida
  modo: ModoPartida
  estado: EstadoPartida
  nivel_inicial: number
  nivel: number
  puntos: number
  vidas: number
  aciertos: number
  respuestas_total: number
  monedas: number
  jefe_derrotado: boolean
  duracion_seg: number
  iniciada_en: Fecha
  actualizada_en: Fecha
  terminada_en: Fecha | null
}

/** Lo que el cliente envía al insertar en `respuestas` (el resto lo calcula la base de datos). */
export interface NuevaRespuesta {
  partida_id: string
  operacion: Operacion
  a: number
  b: number
  respuesta: number
  tiempo_ms?: number
}

export interface Logro {
  id: string
  nombre: string
  descripcion: string
  icono: string
}

export interface ResultadoActualizarPartida {
  partida: Partida
  logros_nuevos: Logro[]
}
