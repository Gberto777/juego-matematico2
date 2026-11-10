import { useCallback, useState, type FormEvent } from 'react'
import { useCarga } from '../../hooks/useCarga'
import { mensajeDeError } from '../../supabase/errores'
import type { DatosReto, ServicioSalas } from '../../supabase/servicioSalas'
import { plazo, validarReto } from '../../utils/retos'
import type { Dificultad, RetoConProgreso, Sala, TemaOperacion } from '../../supabase/tipos'
import { ICONO_TEMA, NOMBRE_DIFICULTAD, NOMBRE_TEMA } from '../../utils/codigoSala'
import { Panel, SegunCarga } from './Comunes'

const claseCampo =
  'w-full rounded-xl border-2 border-indigo-100 bg-white px-4 py-2.5 font-semibold text-indigo-950 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20'

function FormularioReto({ alGuardar }: { alGuardar: (datos: DatosReto) => Promise<void> }) {
  const [titulo, setTitulo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [tema, setTema] = useState<TemaOperacion>('multiplicacion')
  const [dificultad, setDificultad] = useState<Dificultad>('media')
  const [meta, setMeta] = useState('15')
  const [fecha, setFecha] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  const enviar = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const datos: DatosReto = {
      titulo: titulo.trim(),
      descripcion: descripcion.trim(),
      tema,
      dificultad,
      meta_aciertos: Number(meta),
      // El plazo termina al final del día elegido, en la hora local del docente.
      fecha_limite: fecha ? new Date(`${fecha}T23:59:59`).toISOString() : null,
    }
    const errorValidacion = validarReto(datos)
    if (errorValidacion) {
      setError(errorValidacion)
      return
    }
    setError(null)
    setGuardando(true)
    try {
      await alGuardar(datos)
      setTitulo('')
      setDescripcion('')
      setFecha('')
    } catch (err) {
      console.error(err)
      setError(mensajeDeError(err, 'No se pudo crear el reto.'))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <form onSubmit={enviar} noValidate className="grid gap-4 sm:grid-cols-2">
      <label className="flex flex-col gap-1 sm:col-span-2">
        <span className="text-sm font-bold">Título</span>
        <input value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={80} placeholder="Tablas del 7" className={claseCampo} />
      </label>
      <label className="flex flex-col gap-1 sm:col-span-2">
        <span className="text-sm font-bold">Indicaciones (opcional)</span>
        <input
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          maxLength={500}
          placeholder="Practica antes del examen del viernes."
          className={claseCampo}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-bold">Tema</span>
        <select value={tema} onChange={(e) => setTema(e.target.value as TemaOperacion)} className={claseCampo}>
          {(['suma', 'resta', 'multiplicacion', 'mixta'] as TemaOperacion[]).map((t) => (
            <option key={t} value={t}>
              {ICONO_TEMA[t]} {NOMBRE_TEMA[t]}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-bold">Dificultad</span>
        <select value={dificultad} onChange={(e) => setDificultad(e.target.value as Dificultad)} className={claseCampo}>
          {(['facil', 'media', 'dificil'] as Dificultad[]).map((d) => (
            <option key={d} value={d}>
              {NOMBRE_DIFICULTAD[d]}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-bold">Meta de aciertos en una partida</span>
        <input type="number" min={1} max={500} value={meta} onChange={(e) => setMeta(e.target.value)} className={claseCampo} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-bold">Plazo (opcional)</span>
        <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={claseCampo} />
      </label>
      <div className="flex flex-wrap items-center justify-end gap-3 sm:col-span-2">
        <p role="alert" className="mr-auto font-semibold text-rose-600">
          {error && `⚠️ ${error}`}
        </p>
        <button
          type="submit"
          disabled={guardando}
          className="rounded-full bg-indigo-600 px-6 py-2 font-bold text-white hover:bg-indigo-500 disabled:opacity-60"
        >
          {guardando ? '⏳ Creando…' : 'Crear reto'}
        </button>
      </div>
    </form>
  )
}

function DetalleReto({ servicio, reto }: { servicio: ServicioSalas; reto: RetoConProgreso }) {
  const [progreso, recargar] = useCarga(useCallback(() => servicio.progresoReto(reto.id), [servicio, reto.id]))
  return (
    <SegunCarga carga={progreso} recargar={recargar}>
      {(filas) => (
        <ul className="mt-3 grid gap-1 sm:grid-cols-2" aria-label={`Progreso en ${reto.titulo}`}>
          {filas.map((p) => (
            <li key={p.usuario_id} className="flex justify-between gap-3 rounded-xl bg-indigo-50 px-3 py-1.5 text-sm">
              <span className="font-semibold">
                {p.cumplido ? '✅' : '⬜'} {p.nombre}
              </span>
              <span className="tabular-nums">
                {p.mejor_aciertos}/{reto.meta_aciertos}
              </span>
            </li>
          ))}
        </ul>
      )}
    </SegunCarga>
  )
}

/** Retos de la sala: el docente los crea, ve quién los cumplió y los borra. */
function PanelRetos({ servicio, sala }: { servicio: ServicioSalas; sala: Sala }) {
  const [retos, recargar] = useCarga(useCallback(() => servicio.retos(sala.id), [servicio, sala.id]))
  const [abierto, setAbierto] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  return (
    <div className="flex flex-col gap-5">
      <Panel titulo="Nuevo reto">
        <FormularioReto
          alGuardar={async (datos) => {
            await servicio.crearReto(sala.id, datos)
            setAviso(`✅ Reto «${datos.titulo}» creado. Tus alumnos ya lo ven en la sala.`)
            recargar()
          }}
        />
      </Panel>

      <p className="min-h-6 text-left font-semibold text-emerald-100" role="status">
        {aviso}
      </p>

      <Panel titulo="Retos de la sala">
        <SegunCarga carga={retos} recargar={recargar}>
          {(lista) =>
            lista.length === 0 ? (
              <p className="text-indigo-500">Aún no hay retos. Crea uno arriba.</p>
            ) : (
              <ul className="flex flex-col gap-3" aria-label="Retos">
                {lista.map((r) => (
                  <li key={r.id} className="rounded-2xl bg-indigo-50/60 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-lg font-bold">
                          {ICONO_TEMA[r.tema]} {r.titulo}
                        </p>
                        <p className="text-sm text-indigo-600">
                          {r.meta_aciertos} aciertos · {NOMBRE_TEMA[r.tema]} · {NOMBRE_DIFICULTAD[r.dificultad]} · {plazo(r)}
                        </p>
                        {r.descripcion && <p className="mt-1 text-sm">{r.descripcion}</p>}
                      </div>
                      <p className="text-right">
                        <span className="block text-2xl font-bold tabular-nums">
                          {r.cumplidos}/{r.miembros}
                        </span>
                        <span className="text-sm text-indigo-600">lo cumplieron</span>
                      </p>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        aria-expanded={abierto === r.id}
                        onClick={() => setAbierto(abierto === r.id ? null : r.id)}
                        className="rounded-full px-4 py-1.5 text-sm font-bold text-indigo-700 ring-2 ring-indigo-200 hover:bg-indigo-50"
                      >
                        {abierto === r.id ? 'Ocultar detalle' : 'Ver quién lo cumplió'}
                      </button>
                      <button
                        type="button"
                        aria-label={`Borrar el reto ${r.titulo}`}
                        onClick={() => {
                          servicio.borrarReto(r.id).then(
                            () => {
                              setAviso(`Se borró el reto «${r.titulo}».`)
                              recargar()
                            },
                            (error: unknown) => setAviso(`⚠️ ${mensajeDeError(error, 'No se pudo borrar el reto.')}`),
                          )
                        }}
                        className="rounded-full px-4 py-1.5 text-sm font-bold text-rose-700 ring-2 ring-rose-200 hover:bg-rose-50"
                      >
                        Borrar
                      </button>
                    </div>
                    {abierto === r.id && <DetalleReto servicio={servicio} reto={r} />}
                  </li>
                ))}
              </ul>
            )
          }
        </SegunCarga>
      </Panel>
    </div>
  )
}

export default PanelRetos
