import type { ReactNode } from 'react'
import type { Carga } from '../../hooks/useCarga'
import type { ErroresOperacion } from '../../supabase/tipos'
import { NOMBRE_OPERACION } from '../../utils/excel'

/** Tarjeta blanca de las pantallas de trabajo, con título y una acción opcional a la derecha. */
export function Panel({ titulo, accion, children }: { titulo: string; accion?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-3xl bg-white p-5 text-left text-indigo-950 shadow-[0_6px_0_0_rgba(0,0,0,0.15)] sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold">{titulo}</h2>
        {accion}
      </div>
      {children}
    </section>
  )
}

export function Cifra({ etiqueta, valor, nota }: { etiqueta: string; valor: ReactNode; nota?: string }) {
  return (
    <div className="rounded-2xl bg-white/15 px-4 py-3 text-left ring-1 ring-white/20 backdrop-blur">
      <dt className="text-xs font-semibold tracking-widest text-amber-200 uppercase">{etiqueta}</dt>
      <dd className="text-3xl font-bold text-white tabular-nums">{valor}</dd>
      {nota && <dd className="text-sm text-indigo-100">{nota}</dd>}
    </div>
  )
}

/** Muestra el estado de una carga: cargando, error con reintento, o el contenido. */
export function SegunCarga<T>({
  carga,
  recargar,
  children,
}: {
  carga: Carga<T>
  recargar: () => void
  children: (datos: T) => ReactNode
}) {
  if (carga.estado === 'cargando') return <p className="py-4 text-indigo-400">⏳ Cargando…</p>
  if (carga.estado === 'error') {
    return (
      <div className="flex flex-wrap items-center gap-3 py-2" role="alert">
        <p className="font-semibold text-rose-600">⚠️ {carga.mensaje}</p>
        <button
          type="button"
          onClick={recargar}
          className="rounded-full px-4 py-1.5 text-sm font-bold text-indigo-700 ring-2 ring-indigo-200 hover:bg-indigo-50"
        >
          Reintentar
        </button>
      </div>
    )
  }
  return <>{children(carga.datos)}</>
}

/** Barras de porcentaje de fallos por operación (sumas, restas, multiplicaciones). */
export function BarrasErrores({ errores }: { errores: ErroresOperacion[] }) {
  if (errores.length === 0) return <p className="text-indigo-500">Todavía no hay respuestas.</p>
  const peor = errores.reduce((a, b) => (b.porcentaje_fallo > a.porcentaje_fallo ? b : a))
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-3" aria-label="Fallos por operación">
        {errores.map((e) => (
          <li key={e.operacion} className="grid grid-cols-[8.5rem_1fr_3.5rem] items-center gap-3">
            <span className="font-semibold">{NOMBRE_OPERACION[e.operacion]}</span>
            <span className="h-4 overflow-hidden rounded-full bg-indigo-50" aria-hidden="true">
              <span
                className={`block h-full rounded-full ${e === peor ? 'bg-rose-500' : 'bg-indigo-400'}`}
                style={{ width: `${Math.max(2, e.porcentaje_fallo)}%` }}
              />
            </span>
            <span className="text-right font-bold tabular-nums">{e.porcentaje_fallo} %</span>
            <span className="sr-only">
              {e.fallos} fallos de {e.respuestas} respuestas
            </span>
          </li>
        ))}
      </ul>
      {peor.porcentaje_fallo > 0 && (
        <p className="text-sm text-indigo-700">
          Donde más se falla: <strong>{NOMBRE_OPERACION[peor.operacion].toLowerCase()}</strong> ({peor.fallos} de{' '}
          {peor.respuestas}).
        </p>
      )}
    </div>
  )
}
