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

// --- Extras: rankings, estadísticas y retos (migración 20261110000000_extras.sql) ---

export type PeriodoRanking = 'global' | 'semanal'

export interface FilaRanking {
  posicion: number
  usuario_id: string
  nombre: string
  avatar: string
  mejor_puntos: number
  partidas: number
  es_yo: boolean
}

export interface EstadisticaAlumno {
  usuario_id: string
  nombre: string
  avatar: string
  partidas: number
  aciertos: number
  respuestas: number
  /** null si todavía no respondió nada. */
  porcentaje_aciertos: number | null
  mejor_puntos: number
  nivel_max: number
  ultima_partida: Fecha | null
}

export interface ErroresOperacion {
  operacion: Operacion
  respuestas: number
  fallos: number
  porcentaje_fallo: number
}

export interface OperacionDificil {
  operacion: Operacion
  a: number
  b: number
  resultado: number
  intentos: number
  fallos: number
}

export interface PartidaResumen {
  id: string
  origen: OrigenPartida
  modo: ModoPartida
  puntos: number
  nivel: number
  aciertos: number
  respuestas_total: number
  jefe_derrotado: boolean
  terminada_en: Fecha
}

export interface EstadisticasUsuario {
  partidas: number
  puntos_max: number
  nivel_max: number
  aciertos: number
  respuestas: number
  precision: number | null
  monedas: number
  jefe_derrotado: boolean
  minutos_jugados: number
  por_origen: Record<OrigenPartida, number>
  ultimas: PartidaResumen[]
}

export interface EstadisticasSistema {
  usuarios: { total: number; admin: number; docente: number; alumno: number; inactivos: number; nuevos_semana: number }
  salas: { total: number; abiertas: number }
  partidas: { total: number; hoy: number; semana: number; en_curso: number; web: number; movil: number; godot: number }
  respuestas: { total: number; precision: number | null }
  por_dia: { fecha: string; partidas: number }[]
}

export interface RetoConProgreso extends Omit<Reto, 'sala_id' | 'docente_id'> {
  cumplidos: number
  miembros: number
  mi_mejor: number
  cumplido_por_mi: boolean
}

export interface ProgresoReto {
  usuario_id: string
  nombre: string
  mejor_aciertos: number
  intentos: number
  cumplido: boolean
}

export interface RetoDiario {
  fecha: string
  tema: TemaOperacion
  dificultad: Dificultad
  meta_aciertos: number
  mi_mejor: number
  completado: boolean
}

export interface LogroConEstado extends Logro {
  obtenido_en: Fecha | null
}
