import { useCallback } from 'react'
import { useCarga } from '../../hooks/useCarga'
import type { ServicioEstadisticas } from '../../supabase/servicioEstadisticas'
import type { EstadisticasSistema } from '../../supabase/tipos'
import { Panel, SegunCarga } from './Comunes'

const diaCorto = (fecha: string) => new Date(`${fecha}T12:00:00`).toLocaleDateString('es', { weekday: 'narrow', day: 'numeric' })

function Barras({ dias }: { dias: EstadisticasSistema['por_dia'] }) {
  const maximo = Math.max(1, ...dias.map((d) => d.partidas))
  const total = dias.reduce((s, d) => s + d.partidas, 0)
  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="text-sm text-indigo-600">
        Partidas terminadas por día, últimas dos semanas: <strong>{total}</strong> en total.
      </figcaption>
      <ol className="flex h-36 items-end gap-1.5" aria-label="Partidas por día">
        {dias.map((d) => (
          <li key={d.fecha} className="flex h-full flex-1 flex-col items-center justify-end gap-1" title={`${d.fecha}: ${d.partidas}`}>
            <span className="text-xs font-bold text-indigo-700 tabular-nums">{d.partidas > 0 ? d.partidas : ''}</span>
            <span
              className="w-full rounded-t-md bg-indigo-500"
              style={{ height: `${(d.partidas / maximo) * 100}%`, minHeight: d.partidas > 0 ? 4 : 1 }}
            />
            <span className="text-[13px] text-indigo-500">{diaCorto(d.fecha)}</span>
            <span className="sr-only">
              {d.fecha}: {d.partidas} partidas
            </span>
          </li>
        ))}
      </ol>
    </figure>
  )
}

function Dato({ etiqueta, valor, detalle }: { etiqueta: string; valor: number | string; detalle?: string }) {
  return (
    <div className="rounded-2xl bg-indigo-50 px-4 py-3">
      <dt className="text-sm font-semibold text-indigo-600">{etiqueta}</dt>
      <dd className="text-3xl font-bold text-indigo-950 tabular-nums">{valor}</dd>
      {detalle && <dd className="text-sm text-indigo-600">{detalle}</dd>}
    </div>
  )
}

/** Estadísticas del sistema para el panel del admin. */
function ResumenSistema({ servicio }: { servicio: ServicioEstadisticas }) {
  const [carga, recargar] = useCarga(useCallback(() => servicio.estadisticasSistema(), [servicio]))
  return (
    <Panel
      titulo="Resumen del sistema"
      accion={
        <button type="button" onClick={recargar} className="rounded-full px-4 py-1.5 text-sm font-bold text-indigo-700 ring-2 ring-indigo-200 hover:bg-indigo-50">
          🔄 Actualizar
        </button>
      }
    >
      <SegunCarga carga={carga} recargar={recargar}>
        {(s) => (
          <div className="flex flex-col gap-5">
            <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Dato
                etiqueta="Usuarios"
                valor={s.usuarios.total}
                detalle={`${s.usuarios.alumno} alumnos · ${s.usuarios.docente} docentes · ${s.usuarios.nuevos_semana} nuevos esta semana`}
              />
              <Dato etiqueta="Salas abiertas" valor={s.salas.abiertas} detalle={`de ${s.salas.total} creadas`} />
              <Dato etiqueta="Partidas hoy" valor={s.partidas.hoy} detalle={`${s.partidas.semana} esta semana · ${s.partidas.en_curso} en curso`} />
              <Dato
                etiqueta="Aciertos"
                valor={s.respuestas.precision === null ? '—' : `${s.respuestas.precision} %`}
                detalle={`${s.respuestas.total} respuestas`}
              />
            </dl>
            <p className="text-sm text-indigo-700">
              Partidas terminadas por plataforma: web <strong>{s.partidas.web}</strong> · app <strong>{s.partidas.movil}</strong> · MathQuest 3D{' '}
              <strong>{s.partidas.godot}</strong>
            </p>
            <Barras dias={s.por_dia} />
          </div>
        )}
      </SegunCarga>
    </Panel>
  )
}

export default ResumenSistema
