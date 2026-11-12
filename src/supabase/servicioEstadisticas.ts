import type { SupabaseClient } from '@supabase/supabase-js'
import { getSupabase, isSupabaseConfigured } from './cliente'
import type {
  ErroresOperacion,
  EstadisticaAlumno,
  EstadisticasSistema,
  EstadisticasUsuario,
  FilaRanking,
  Logro,
  LogroConEstado,
  OperacionDificil,
  PeriodoRanking,
  RetoDiario,
  Usuario,
} from './tipos'

/** Lecturas agregadas (rankings, estadísticas, logros) y la edición del propio perfil. */
export interface ServicioEstadisticas {
  ranking(periodo: PeriodoRanking, salaId?: string, limite?: number): Promise<FilaRanking[]>
  estadisticasSala(salaId: string): Promise<EstadisticaAlumno[]>
  erroresPorOperacion(filtro?: { salaId?: string; usuarioId?: string }): Promise<ErroresOperacion[]>
  operacionesDificiles(filtro?: { salaId?: string; usuarioId?: string; limite?: number }): Promise<OperacionDificil[]>
  estadisticasUsuario(usuarioId?: string): Promise<EstadisticasUsuario>
  estadisticasSistema(): Promise<EstadisticasSistema>
  retoDiario(): Promise<RetoDiario>
  /** Catálogo completo con la fecha en que el usuario consiguió cada uno (o null). */
  logros(usuarioId: string): Promise<LogroConEstado[]>
  actualizarPerfil(usuarioId: string, cambios: { nombre?: string; avatar?: string }): Promise<Usuario>
}

/** PostgREST devuelve los bigint como número; si algún día llegan como texto, se convierten aquí. */
const numeros = <T extends object>(filas: T[], claves: (keyof T)[]): T[] =>
  filas.map((fila) => {
    const copia = { ...fila }
    for (const clave of claves) {
      const valor = copia[clave]
      if (typeof valor === 'string') (copia as Record<keyof T, unknown>)[clave] = Number(valor)
    }
    return copia
  })

export function crearServicioEstadisticas(sb: SupabaseClient): ServicioEstadisticas {
  async function rpc<T>(nombre: string, args: Record<string, unknown> = {}): Promise<T> {
    const { data, error } = await sb.rpc(nombre, args)
    if (error) throw error
    return data as T
  }

  return {
    async ranking(periodo, salaId, limite = 20) {
      const filas = await rpc<FilaRanking[]>('ranking', { p_periodo: periodo, p_sala_id: salaId ?? null, p_limite: limite })
      return numeros(filas ?? [], ['posicion', 'partidas'])
    },
    async estadisticasSala(salaId) {
      const filas = await rpc<EstadisticaAlumno[]>('estadisticas_sala', { p_sala_id: salaId })
      return numeros(filas ?? [], ['partidas', 'aciertos', 'respuestas'])
    },
    async erroresPorOperacion(filtro = {}) {
      const filas = await rpc<ErroresOperacion[]>('errores_por_operacion', {
        p_sala_id: filtro.salaId ?? null,
        p_usuario_id: filtro.usuarioId ?? null,
      })
      return numeros(filas ?? [], ['respuestas', 'fallos'])
    },
    async operacionesDificiles(filtro = {}) {
      const filas = await rpc<OperacionDificil[]>('operaciones_dificiles', {
        p_sala_id: filtro.salaId ?? null,
        p_usuario_id: filtro.usuarioId ?? null,
        p_limite: filtro.limite ?? 10,
      })
      return numeros(filas ?? [], ['intentos', 'fallos'])
    },
    estadisticasUsuario: (usuarioId) => rpc('estadisticas_usuario', { p_usuario_id: usuarioId ?? null }),
    estadisticasSistema: () => rpc('estadisticas_sistema'),
    retoDiario: () => rpc('reto_diario'),

    async logros(usuarioId) {
      const [catalogo, mios] = await Promise.all([
        sb.from('logros').select('id, nombre, descripcion, icono, orden').order('orden'),
        sb.from('usuario_logros').select('logro_id, obtenido_en').eq('usuario_id', usuarioId),
      ])
      if (catalogo.error) throw catalogo.error
      if (mios.error) throw mios.error
      const fechas = new Map((mios.data ?? []).map((m) => [m.logro_id as string, m.obtenido_en as string]))
      return ((catalogo.data ?? []) as (Logro & { orden: number })[]).map(({ orden: _orden, ...l }) => ({
        ...l,
        obtenido_en: fechas.get(l.id) ?? null,
      }))
    },

    async actualizarPerfil(usuarioId, cambios) {
      const { data, error } = await sb.from('usuarios').update(cambios).eq('id', usuarioId).select().single<Usuario>()
      if (error) throw error
      return data as Usuario
    },
  }
}

let servicioPorDefecto: ServicioEstadisticas | null | undefined

export function obtenerServicioEstadisticas(): ServicioEstadisticas | null {
  if (servicioPorDefecto === undefined) {
    servicioPorDefecto = isSupabaseConfigured ? crearServicioEstadisticas(getSupabase()) : null
  }
  return servicioPorDefecto
}
