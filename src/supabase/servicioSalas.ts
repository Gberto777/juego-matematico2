import type { SupabaseClient } from '@supabase/supabase-js'
import { getSupabase, isSupabaseConfigured } from './cliente'
import type {
  Dificultad,
  EstadoSala,
  MiembroSala,
  ModoPartida,
  NuevaRespuesta,
  OrigenPartida,
  Partida,
  ProgresoReto,
  RetoConProgreso,
  ResultadoActualizarPartida,
  Sala,
  TemaOperacion,
} from './tipos'

/** Sala con datos extra para las listas: nombre del docente y número de alumnos. */
export interface SalaConResumen extends Sala {
  docente_nombre: string | null
  miembros: number
}

export interface DatosSala {
  nombre: string
  tema: TemaOperacion
  dificultad: Dificultad
  max_jugadores: number
}

export type CambiosSala = Partial<DatosSala> & { estado?: EstadoSala }

export interface InicioPartida {
  origen: OrigenPartida
  nivelInicial: number
  salaId?: string
  /** Partida de un reto del docente (la sala sale del reto). */
  retoId?: string
  /** Por defecto lo decide el servidor (práctica, sala o reto); "diario" para el reto del día. */
  modo?: ModoPartida
}

export interface DatosReto {
  titulo: string
  descripcion: string
  tema: TemaOperacion
  dificultad: Dificultad
  meta_aciertos: number
  /** ISO 8601, o null si no tiene plazo. */
  fecha_limite: string | null
}

export interface ProgresoPartida {
  puntos: number
  nivel: number
  vidas: number
  terminar: boolean
}

/** Envío de partidas y respuestas (lo usa el reportador del juego). */
export interface ApiPartidas {
  iniciar(datos: InicioPartida): Promise<Partida>
  enviarRespuestas(respuestas: NuevaRespuesta[]): Promise<void>
  actualizar(partidaId: string, progreso: ProgresoPartida): Promise<ResultadoActualizarPartida>
}

/** Todo lo que la web hace con las salas. Interfaz para poder probar sin red. */
export interface ServicioSalas extends ApiPartidas {
  /** Salas visibles: las propias (docente), todas (admin) o en las que está (alumno). */
  listar(): Promise<SalaConResumen[]>
  buscarPorCodigo(codigo: string): Promise<Sala | null>
  crear(datos: DatosSala): Promise<Sala>
  actualizarSala(id: string, cambios: CambiosSala): Promise<Sala>
  borrar(id: string): Promise<void>
  miembros(salaId: string): Promise<MiembroSala[]>
  expulsar(salaId: string, usuarioId: string): Promise<void>
  unirse(codigo: string): Promise<Sala>
  salir(salaId: string, usuarioId: string): Promise<void>
  /** Marca al usuario como conectado. Devuelve el estado de la sala o null si ya no es miembro. */
  latido(salaId: string): Promise<EstadoSala | null>
  /** Avisa de cualquier cambio en la sala, sus miembros o sus partidas (Supabase Realtime). */
  escucharSala(salaId: string, alCambiar: () => void): () => void
  retos(salaId: string): Promise<RetoConProgreso[]>
  progresoReto(retoId: string): Promise<ProgresoReto[]>
  crearReto(salaId: string, datos: DatosReto): Promise<void>
  borrarReto(retoId: string): Promise<void>
}

interface FilaSala extends Sala {
  docente: { nombre: string } | null
  sala_miembros: { count: number }[]
}

export function crearServicioSalas(sb: SupabaseClient): ServicioSalas {
  const lanzar = (error: unknown) => {
    if (error) throw error
  }

  return {
    async listar() {
      const { data, error } = await sb
        .from('salas')
        .select('*, docente:usuarios!salas_docente_id_fkey(nombre), sala_miembros(count)')
        .order('creado_en', { ascending: false })
        .returns<FilaSala[]>()
      lanzar(error)
      return (data ?? []).map(({ docente, sala_miembros, ...sala }) => ({
        ...sala,
        docente_nombre: docente?.nombre ?? null,
        miembros: sala_miembros[0]?.count ?? 0,
      }))
    },

    async buscarPorCodigo(codigo) {
      const { data, error } = await sb.from('salas').select('*').eq('codigo', codigo).maybeSingle<Sala>()
      lanzar(error)
      return data
    },

    async crear(datos) {
      const { data, error } = await sb
        .rpc('crear_sala', {
          p_nombre: datos.nombre,
          p_tema: datos.tema,
          p_dificultad: datos.dificultad,
          p_max_jugadores: datos.max_jugadores,
        })
        .single<Sala>()
      lanzar(error)
      return data as Sala
    },

    async actualizarSala(id, cambios) {
      const { data, error } = await sb.from('salas').update(cambios).eq('id', id).select().single<Sala>()
      lanzar(error)
      return data as Sala
    },

    async borrar(id) {
      const { error } = await sb.from('salas').delete().eq('id', id)
      lanzar(error)
    },

    async miembros(salaId) {
      const { data, error } = await sb.rpc('miembros_sala', { p_sala_id: salaId })
      lanzar(error)
      return (data ?? []) as MiembroSala[]
    },

    async expulsar(salaId, usuarioId) {
      const { error } = await sb.from('sala_miembros').delete().eq('sala_id', salaId).eq('usuario_id', usuarioId)
      lanzar(error)
    },

    async unirse(codigo) {
      const { data, error } = await sb.rpc('unirse_sala', { p_codigo: codigo }).single<Sala>()
      lanzar(error)
      return data as Sala
    },

    async salir(salaId, usuarioId) {
      const { error } = await sb.from('sala_miembros').delete().eq('sala_id', salaId).eq('usuario_id', usuarioId)
      lanzar(error)
    },

    async latido(salaId) {
      const { data, error } = await sb.rpc('latido_sala', { p_sala_id: salaId })
      lanzar(error)
      return (data as EstadoSala | null) ?? null
    },

    escucharSala(salaId, alCambiar) {
      const canal = sb
        .channel(`sala-${salaId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'salas', filter: `id=eq.${salaId}` }, alCambiar)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'sala_miembros', filter: `sala_id=eq.${salaId}` }, alCambiar)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'partidas', filter: `sala_id=eq.${salaId}` }, alCambiar)
        .subscribe()
      return () => {
        void sb.removeChannel(canal)
      }
    },

    async retos(salaId) {
      const { data, error } = await sb.rpc('retos_sala', { p_sala_id: salaId })
      lanzar(error)
      return ((data ?? []) as RetoConProgreso[]).map((r) => ({ ...r, cumplidos: Number(r.cumplidos), miembros: Number(r.miembros) }))
    },

    async progresoReto(retoId) {
      const { data, error } = await sb.rpc('progreso_reto', { p_reto_id: retoId })
      lanzar(error)
      return ((data ?? []) as ProgresoReto[]).map((p) => ({ ...p, intentos: Number(p.intentos) }))
    },

    async crearReto(salaId, datos) {
      const { error } = await sb.from('retos').insert({ sala_id: salaId, ...datos })
      lanzar(error)
    },

    async borrarReto(retoId) {
      const { error } = await sb.from('retos').delete().eq('id', retoId)
      lanzar(error)
    },

    async iniciar({ origen, nivelInicial, salaId, retoId, modo }) {
      const { data, error } = await sb
        .rpc('iniciar_partida', {
          p_origen: origen,
          p_nivel_inicial: nivelInicial,
          ...(retoId ? { p_reto_id: retoId } : salaId && { p_sala_id: salaId }),
          ...(modo && { p_modo: modo }),
        })
        .single<Partida>()
      lanzar(error)
      return data as Partida
    },

    async enviarRespuestas(respuestas) {
      if (respuestas.length === 0) return
      const { error } = await sb.from('respuestas').insert(respuestas)
      lanzar(error)
    },

    async actualizar(partidaId, { puntos, nivel, vidas, terminar }) {
      const { data, error } = await sb.rpc('actualizar_partida', {
        p_partida_id: partidaId,
        p_puntos: puntos,
        p_nivel: nivel,
        p_vidas: vidas,
        p_terminar: terminar,
      })
      lanzar(error)
      return data as ResultadoActualizarPartida
    },
  }
}

let servicioPorDefecto: ServicioSalas | null | undefined

export function obtenerServicioSalas(): ServicioSalas | null {
  if (servicioPorDefecto === undefined) {
    servicioPorDefecto = isSupabaseConfigured ? crearServicioSalas(getSupabase()) : null
  }
  return servicioPorDefecto
}
