import { useCallback, useEffect, useState } from 'react'
import { mensajeDeError } from '../../supabase/errores'
import type { SalaConResumen, ServicioSalas } from '../../supabase/servicioSalas'
import type { Usuario } from '../../supabase/tipos'
import { ICONO_TEMA, NOMBRE_DIFICULTAD, NOMBRE_TEMA } from '../../utils/codigoSala'
import { routeToHash } from '../../utils/routes'
import SecondaryButton from '../SecondaryButton'
import StatusMessage from '../StatusMessage'
import FormularioSala from './FormularioSala'

interface PanelDocenteProps {
  servicio: ServicioSalas
  yo: Usuario
}

type Carga = { estado: 'cargando' } | { estado: 'listo'; salas: SalaConResumen[] } | { estado: 'error'; mensaje: string }

const claseBoton =
  'rounded-full px-4 py-1.5 text-sm font-bold ring-2 transition-colors focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 disabled:opacity-40'

export function EstadoSalaInsignia({ abierta }: { abierta: boolean }) {
  return abierta ? (
    <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800 uppercase">🟢 Abierta</span>
  ) : (
    <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-bold text-slate-700 uppercase">🔒 Cerrada</span>
  )
}

interface TarjetaSalaProps {
  sala: SalaConResumen
  mostrarDocente: boolean
  alCambiarEstado: () => Promise<void>
  alBorrar: () => Promise<void>
}

function TarjetaSala({ sala, mostrarDocente, alCambiarEstado, alBorrar }: TarjetaSalaProps) {
  const [confirmarBorrado, setConfirmarBorrado] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const abierta = sala.estado === 'abierta'

  const ejecutar = async (accion: () => Promise<void>) => {
    setOcupado(true)
    try {
      await accion()
    } finally {
      setOcupado(false)
    }
  }

  return (
    <li className="flex flex-col gap-3 rounded-3xl bg-white p-5 text-left shadow-[0_6px_0_0_rgba(0,0,0,0.15)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-2xl font-bold tracking-wider text-indigo-700">{sala.codigo}</p>
          <h2 className="truncate text-xl font-bold text-indigo-950">{sala.nombre}</h2>
          {mostrarDocente && sala.docente_nombre && <p className="text-sm text-indigo-500">Docente: {sala.docente_nombre}</p>}
        </div>
        <EstadoSalaInsignia abierta={abierta} />
      </div>

      <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm font-semibold text-indigo-700">
        <span>
          {ICONO_TEMA[sala.tema]} {NOMBRE_TEMA[sala.tema]}
        </span>
        <span>🎚️ {NOMBRE_DIFICULTAD[sala.dificultad]}</span>
        <span>
          👥 {sala.miembros}/{sala.max_jugadores}
        </span>
      </p>

      <div className="mt-auto flex flex-wrap items-center gap-2">
        {confirmarBorrado ? (
          <>
            <span className="text-sm font-semibold text-rose-700">¿Borrar la sala y sus resultados?</span>
            <button
              type="button"
              disabled={ocupado}
              onClick={() => void ejecutar(alBorrar)}
              className={`${claseBoton} bg-rose-600 text-white ring-rose-600 hover:bg-rose-500`}
            >
              Sí, borrar
            </button>
            <button
              type="button"
              onClick={() => setConfirmarBorrado(false)}
              className={`${claseBoton} text-indigo-700 ring-indigo-200 hover:bg-indigo-50`}
            >
              No
            </button>
          </>
        ) : (
          <>
            <a
              href={routeToHash({ name: 'teacherRoom', code: sala.codigo })}
              className={`${claseBoton} bg-indigo-600 text-white ring-indigo-600 hover:bg-indigo-500`}
            >
              📊 Ver sala
            </a>
            <button
              type="button"
              disabled={ocupado}
              onClick={() => void ejecutar(alCambiarEstado)}
              aria-label={`${abierta ? 'Cerrar' : 'Abrir'} la sala ${sala.codigo}`}
              className={`${claseBoton} text-indigo-700 ring-indigo-200 hover:bg-indigo-50`}
            >
              {abierta ? '🔒 Cerrar' : '🔓 Abrir'}
            </button>
            <button
              type="button"
              onClick={() => setConfirmarBorrado(true)}
              aria-label={`Borrar la sala ${sala.codigo}`}
              className={`${claseBoton} text-rose-700 ring-rose-200 hover:bg-rose-50`}
            >
              🗑️ Borrar
            </button>
          </>
        )}
      </div>
    </li>
  )
}

/** Panel docente: crear salas con código y gestionarlas (abrir, cerrar, borrar, ver). */
function PanelDocente({ servicio, yo }: PanelDocenteProps) {
  const [carga, setCarga] = useState<Carga>({ estado: 'cargando' })
  const [creando, setCreando] = useState(false)
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)
  const [intento, setIntento] = useState(0)

  useEffect(() => {
    let cancelado = false
    servicio.listar().then(
      (salas) => !cancelado && setCarga({ estado: 'listo', salas }),
      (error: unknown) => {
        console.error('No se pudieron cargar las salas', error)
        if (!cancelado) setCarga({ estado: 'error', mensaje: mensajeDeError(error, 'No se pudieron cargar las salas.') })
      },
    )
    return () => {
      cancelado = true
    }
  }, [servicio, intento])

  const cambiarSalas = useCallback((cambio: (salas: SalaConResumen[]) => SalaConResumen[]) => {
    setCarga((actual) => (actual.estado === 'listo' ? { estado: 'listo', salas: cambio(actual.salas) } : actual))
  }, [])

  const conAviso = useCallback(async (accion: () => Promise<string>) => {
    try {
      setAviso({ tipo: 'ok', texto: await accion() })
    } catch (error) {
      console.error(error)
      setAviso({ tipo: 'error', texto: mensajeDeError(error, 'No se pudo completar la acción.') })
    }
  }, [])

  if (carga.estado === 'cargando') return <StatusMessage icon="⏳" title="Cargando tus salas…" />
  if (carga.estado === 'error') {
    return (
      <StatusMessage icon="📡" title="No se pudieron cargar las salas">
        <p>{carga.mensaje}</p>
        <SecondaryButton
          onClick={() => {
            setCarga({ estado: 'cargando' })
            setIntento((n) => n + 1)
          }}
        >
          🔄 Reintentar
        </SecondaryButton>
      </StatusMessage>
    )
  }

  const esAdmin = yo.rol === 'admin'

  return (
    <section className="flex w-full max-w-5xl flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3 text-left">
        <div>
          <p className="text-sm font-semibold tracking-widest text-amber-200 uppercase">Panel docente</p>
          <h1 className="text-4xl font-bold text-white drop-shadow-[0_3px_0_rgba(0,0,0,0.2)]">
            {esAdmin ? 'Todas las salas' : 'Mis salas'}
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <a href="#/cuenta" className="font-semibold text-white underline decoration-white/40 underline-offset-4 hover:decoration-amber-300">
            ⬅ Mi cuenta
          </a>
          {!creando && (
            <button
              type="button"
              onClick={() => setCreando(true)}
              className="rounded-full bg-amber-400 px-5 py-2 text-base font-bold text-amber-950 shadow-[0_4px_0_0_var(--color-amber-600)] hover:bg-amber-300 focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-white active:translate-y-1 active:shadow-none"
            >
              ➕ Nueva sala
            </button>
          )}
        </div>
      </header>

      {creando && (
        <div className="rounded-3xl bg-white p-5 shadow-[0_6px_0_0_rgba(0,0,0,0.15)]">
          <h2 className="mb-4 text-left text-xl font-bold text-indigo-950">Nueva sala</h2>
          <FormularioSala
            textoBoton="Crear sala"
            alCancelar={() => setCreando(false)}
            alGuardar={async (datos) => {
              const sala = await servicio.crear(datos)
              cambiarSalas((salas) => [{ ...sala, docente_nombre: yo.nombre, miembros: 0 }, ...salas])
              setCreando(false)
              setAviso({ tipo: 'ok', texto: `Sala creada. Comparte el código ${sala.codigo} con tus alumnos.` })
            }}
          />
        </div>
      )}

      <div className="min-h-6" role="status" aria-live="polite">
        {aviso && (
          <p className={`text-left font-semibold ${aviso.tipo === 'ok' ? 'text-emerald-100' : 'text-rose-200'}`}>
            {aviso.tipo === 'ok' ? '✅' : '⚠️'} {aviso.texto}
          </p>
        )}
      </div>

      {carga.salas.length === 0 ? (
        <div className="rounded-3xl bg-white/15 px-6 py-10 text-lg text-indigo-50 ring-1 ring-white/20">
          Aún no tienes salas. Crea una y comparte su código para que tus alumnos entren.
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Salas">
          {carga.salas.map((sala) => (
            <TarjetaSala
              key={sala.id}
              sala={sala}
              mostrarDocente={esAdmin && sala.docente_id !== yo.id}
              alCambiarEstado={() =>
                conAviso(async () => {
                  const estado = sala.estado === 'abierta' ? 'cerrada' : 'abierta'
                  const actualizada = await servicio.actualizarSala(sala.id, { estado })
                  cambiarSalas((salas) => salas.map((s) => (s.id === sala.id ? { ...s, ...actualizada } : s)))
                  return estado === 'cerrada'
                    ? `La sala ${sala.codigo} está cerrada: nadie más puede entrar ni enviar resultados.`
                    : `La sala ${sala.codigo} vuelve a estar abierta.`
                })
              }
              alBorrar={() =>
                conAviso(async () => {
                  await servicio.borrar(sala.id)
                  cambiarSalas((salas) => salas.filter((s) => s.id !== sala.id))
                  return `Se borró la sala ${sala.codigo}.`
                })
              }
            />
          ))}
        </ul>
      )}
    </section>
  )
}

export default PanelDocente
