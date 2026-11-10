import { useCallback, useState } from 'react'
import { useCarga } from '../../hooks/useCarga'
import type { ServicioEstadisticas } from '../../supabase/servicioEstadisticas'
import type { FilaRanking, PeriodoRanking } from '../../supabase/tipos'
import { emojiAvatar } from '../../utils/avatares'
import { Panel, SegunCarga } from './Comunes'

const MEDALLA: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' }

function Filas({ filas }: { filas: FilaRanking[] }) {
  if (filas.length === 0) return <p className="py-4 text-indigo-500">Todavía no hay partidas terminadas en este periodo.</p>
  return (
    <ol className="flex flex-col gap-1" aria-label="Ranking">
      {filas.map((f) => (
        <li
          key={f.usuario_id}
          className={`grid grid-cols-[3rem_2.5rem_1fr_auto] items-center gap-2 rounded-2xl px-3 py-2 ${f.es_yo ? 'bg-amber-100' : ''}`}
        >
          <span className="text-center text-lg font-bold tabular-nums">{MEDALLA[f.posicion] ?? `${f.posicion}.`}</span>
          <span className="text-2xl" aria-hidden="true">
            {emojiAvatar(f.avatar)}
          </span>
          <span className="truncate font-semibold">
            {f.nombre}
            {f.es_yo && <span className="ml-2 text-sm text-amber-800">(tú)</span>}
            <span className="block text-sm font-normal text-indigo-500">
              {f.partidas} {f.partidas === 1 ? 'partida' : 'partidas'}
            </span>
          </span>
          <span className="text-xl font-bold tabular-nums">{f.mejor_puntos}</span>
        </li>
      ))}
    </ol>
  )
}

/** Ranking con pestañas "Siempre" y "Esta semana". Con `salaId`, solo esa sala. */
export function TablaRanking({ servicio, salaId, titulo = 'Ranking' }: { servicio: ServicioEstadisticas; salaId?: string; titulo?: string }) {
  const [periodo, setPeriodo] = useState<PeriodoRanking>('semanal')
  const [carga, recargar] = useCarga(useCallback(() => servicio.ranking(periodo, salaId), [servicio, salaId, periodo]))

  const pestaña = (valor: PeriodoRanking, texto: string) => (
    <button
      type="button"
      aria-pressed={periodo === valor}
      onClick={() => setPeriodo(valor)}
      className={`rounded-full px-4 py-1.5 text-sm font-bold ${periodo === valor ? 'bg-indigo-600 text-white' : 'text-indigo-700 ring-2 ring-indigo-200 hover:bg-indigo-50'}`}
    >
      {texto}
    </button>
  )

  return (
    <Panel
      titulo={titulo}
      accion={
        <div className="flex gap-2" role="group" aria-label="Periodo del ranking">
          {pestaña('semanal', 'Esta semana')}
          {pestaña('global', 'Siempre')}
        </div>
      }
    >
      <SegunCarga carga={carga} recargar={recargar}>
        {(filas) => <Filas filas={filas} />}
      </SegunCarga>
    </Panel>
  )
}

/** #/ranking: el ranking global de MathQuest (web, app y juego 3D juntos). */
export default function PantallaRanking({ servicio }: { servicio: ServicioEstadisticas }) {
  return (
    <section className="flex w-full max-w-2xl flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3 text-left">
        <div>
          <p className="text-sm font-semibold tracking-widest text-amber-200 uppercase">Web, app y MathQuest 3D</p>
          <h1 className="text-4xl font-bold text-white drop-shadow-[0_3px_0_rgba(0,0,0,0.2)]">🏆 Ranking</h1>
        </div>
        <a href="#/practica" className="font-semibold text-white underline decoration-white/40 underline-offset-4">
          🎮 Jugar
        </a>
      </header>
      <TablaRanking servicio={servicio} titulo="Mejores puntuaciones" />
    </section>
  )
}
