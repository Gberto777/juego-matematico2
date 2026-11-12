import { useState } from 'react'
import { useSalaEnVivo } from '../../hooks/useSalaEnVivo'
import { mensajeDeError } from '../../supabase/errores'
import type { ServicioEstadisticas } from '../../supabase/servicioEstadisticas'
import type { ServicioSalas } from '../../supabase/servicioSalas'
import PanelProgreso from '../estadisticas/PanelProgreso'
import PanelRetos from '../estadisticas/PanelRetos'
import { TablaRanking } from '../estadisticas/Ranking'
import type { MiembroSala, Sala } from '../../supabase/tipos'
import { emojiAvatar } from '../../utils/avatares'
import { ICONO_TEMA, NOMBRE_DIFICULTAD, NOMBRE_TEMA, haceCuanto } from '../../utils/codigoSala'
import { routeToHash } from '../../utils/routes'
import { urlDeLaApp } from '../../supabase/servicioAuth'
import SecondaryButton from '../SecondaryButton'
import StatusMessage from '../StatusMessage'
import FormularioSala from './FormularioSala'
import { EstadoSalaInsignia } from './PanelDocente'

interface PantallaSalaDocenteProps {
  servicio: ServicioSalas
  codigo: string
  /** Progreso y ranking de la sala; sin él solo se muestran "En vivo" y "Retos". */
  estadisticas?: ServicioEstadisticas | null
}

type Pestaña = 'vivo' | 'progreso' | 'retos' | 'ranking'
const PESTAÑAS: { id: Pestaña; texto: string }[] = [
  { id: 'vivo', texto: '🟢 En vivo' },
  { id: 'progreso', texto: '📈 Progreso' },
  { id: 'retos', texto: '🎯 Retos' },
  { id: 'ranking', texto: '🏆 Ranking' },
]

const claseBoton =
  'rounded-full px-4 py-1.5 text-sm font-bold ring-2 transition-colors focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 disabled:opacity-40'

function FilaMiembro({ miembro, alExpulsar }: { miembro: MiembroSala; alExpulsar: () => Promise<void> }) {
  const [confirmando, setConfirmando] = useState(false)
  const [ocupado, setOcupado] = useState(false)

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-5">
      <span className="relative text-3xl" aria-hidden="true">
        {emojiAvatar(miembro.avatar)}
        <span
          className={`absolute -right-0.5 -bottom-0.5 size-3.5 rounded-full ring-2 ring-white ${miembro.conectado ? 'bg-emerald-500' : 'bg-slate-300'}`}
        />
      </span>
      <div className="min-w-0 flex-1 text-left">
        <p className="truncate font-bold text-indigo-950">{miembro.nombre}</p>
        <p className="text-sm text-indigo-500">
          {miembro.conectado ? 'Conectado' : `Visto ${haceCuanto(miembro.ultima_actividad)}`}
        </p>
      </div>

      <div className="text-left text-sm font-semibold text-indigo-800 sm:w-56">
        {miembro.jugando ? (
          <span>
            🎮 Jugando · nivel {miembro.nivel} · {miembro.puntos} pts · {'❤️'.repeat(Math.max(0, miembro.vidas ?? 0))}
          </span>
        ) : (
          <span className="text-indigo-400">En espera</span>
        )}
      </div>
      <div className="text-left text-sm text-indigo-600 sm:w-40">
        {miembro.partidas_terminadas} {miembro.partidas_terminadas === 1 ? 'partida' : 'partidas'} · mejor {miembro.mejor_puntos}
      </div>

      <div className="flex gap-2">
        {confirmando ? (
          <>
            <button
              type="button"
              disabled={ocupado}
              onClick={() => {
                setOcupado(true)
                void alExpulsar().finally(() => setOcupado(false))
              }}
              className={`${claseBoton} bg-rose-600 text-white ring-rose-600 hover:bg-rose-500`}
            >
              Sí, quitar
            </button>
            <button
              type="button"
              onClick={() => setConfirmando(false)}
              className={`${claseBoton} text-indigo-700 ring-indigo-200 hover:bg-indigo-50`}
            >
              No
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmando(true)}
            aria-label={`Quitar a ${miembro.nombre} de la sala`}
            className={`${claseBoton} text-rose-700 ring-rose-200 hover:bg-rose-50`}
          >
            Quitar
          </button>
        )}
      </div>
    </li>
  )
}

function Cabecera({ sala }: { sala: Sala }) {
  const enlace = urlDeLaApp(routeToHash({ name: 'studentRoom', code: sala.codigo }))
  return (
    <div className="flex flex-col items-center gap-2 rounded-3xl bg-white/15 px-6 py-5 text-center ring-1 ring-white/20 backdrop-blur">
      <p className="text-sm font-semibold tracking-widest text-amber-200 uppercase">Código para entrar</p>
      <p className="font-mono text-6xl font-bold tracking-widest text-white drop-shadow-[0_4px_0_rgba(0,0,0,0.25)] sm:text-8xl">
        {sala.codigo}
      </p>
      <p className="text-indigo-100">
        En la web: <span className="font-semibold break-all text-white">{enlace}</span> · o en la app y en MathQuest
      </p>
    </div>
  )
}

/** Panel de una sala: código para proyectar, quién está conectado y qué está haciendo, y controles. */
function PantallaSalaDocente({ servicio, codigo, estadisticas = null }: PantallaSalaDocenteProps) {
  const [vivo, recargar] = useSalaEnVivo(servicio, codigo)
  const [pestaña, setPestaña] = useState<Pestaña>('vivo')
  const [editando, setEditando] = useState(false)
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)
  const [cambiandoEstado, setCambiandoEstado] = useState(false)

  if (vivo.estado === 'cargando') return <StatusMessage icon="⏳" title="Cargando la sala…" />
  if (vivo.estado === 'no-existe') {
    return (
      <StatusMessage icon="🔍" title="No se encontró la sala">
        <p>Puede que se haya borrado o que no sea tuya.</p>
        <a href="#/docente" className="font-semibold text-white underline underline-offset-4">
          ⬅ Volver a mis salas
        </a>
      </StatusMessage>
    )
  }
  if (vivo.estado === 'error') {
    return (
      <StatusMessage icon="📡" title="No se pudo cargar la sala">
        <p>{vivo.mensaje}</p>
        <SecondaryButton onClick={recargar}>🔄 Reintentar</SecondaryButton>
      </StatusMessage>
    )
  }

  const { sala, miembros } = vivo
  const conectados = miembros.filter((m) => m.conectado).length
  const jugando = miembros.filter((m) => m.jugando).length
  const abierta = sala.estado === 'abierta'

  const accion = async (hacer: () => Promise<string>) => {
    try {
      setAviso({ tipo: 'ok', texto: await hacer() })
      recargar()
    } catch (error) {
      console.error(error)
      setAviso({ tipo: 'error', texto: mensajeDeError(error, 'No se pudo completar la acción.') })
    }
  }

  return (
    <section className="flex w-full max-w-5xl flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3 text-left">
        <div className="min-w-0">
          <p className="text-sm font-semibold tracking-widest text-amber-200 uppercase">
            {ICONO_TEMA[sala.tema]} {NOMBRE_TEMA[sala.tema]} · {NOMBRE_DIFICULTAD[sala.dificultad]}
          </p>
          <h1 className="truncate text-4xl font-bold text-white drop-shadow-[0_3px_0_rgba(0,0,0,0.2)]">{sala.nombre}</h1>
        </div>
        <a href="#/docente" className="font-semibold text-white underline decoration-white/40 underline-offset-4 hover:decoration-amber-300">
          ⬅ Mis salas
        </a>
      </header>

      <Cabecera sala={sala} />

      <div className="flex flex-wrap items-center gap-3">
        <EstadoSalaInsignia abierta={abierta} />
        <p className="font-semibold text-white">
          🟢 {conectados} conectados · 🎮 {jugando} jugando · 👥 {miembros.length}/{sala.max_jugadores}
        </p>
        <div className="ml-auto flex flex-wrap gap-2">
          <button
            type="button"
            disabled={cambiandoEstado}
            onClick={() => {
              setCambiandoEstado(true)
              void accion(async () => {
                await servicio.actualizarSala(sala.id, { estado: abierta ? 'cerrada' : 'abierta' })
                return abierta ? 'Sala cerrada: nadie más puede entrar ni enviar resultados.' : 'Sala abierta de nuevo.'
              }).finally(() => setCambiandoEstado(false))
            }}
            className="rounded-full bg-white px-5 py-2 font-bold text-indigo-800 shadow-[0_4px_0_0_rgba(0,0,0,0.15)] hover:bg-indigo-50 focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-60"
          >
            {abierta ? '🔒 Cerrar sala' : '🔓 Abrir sala'}
          </button>
          {!editando && (
            <button
              type="button"
              onClick={() => setEditando(true)}
              className="rounded-full px-5 py-2 font-bold text-white ring-2 ring-white/40 hover:bg-white/15 focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              ✏️ Editar
            </button>
          )}
        </div>
      </div>

      {editando && (
        <div className="rounded-3xl bg-white p-5 shadow-[0_6px_0_0_rgba(0,0,0,0.15)]">
          <h2 className="mb-4 text-left text-xl font-bold text-indigo-950">Editar sala</h2>
          <FormularioSala
            inicial={sala}
            textoBoton="Guardar cambios"
            alCancelar={() => setEditando(false)}
            alGuardar={async (datos) => {
              await servicio.actualizarSala(sala.id, datos)
              setEditando(false)
              setAviso({ tipo: 'ok', texto: 'Se guardaron los cambios de la sala.' })
              recargar()
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

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Vistas de la sala">
        {PESTAÑAS.filter((p) => p.id === 'vivo' || p.id === 'retos' || estadisticas).map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={pestaña === p.id}
            onClick={() => setPestaña(p.id)}
            className={`rounded-full px-5 py-2 font-bold transition-colors ${
              pestaña === p.id ? 'bg-white text-indigo-800' : 'text-white ring-2 ring-white/40 hover:bg-white/15'
            }`}
          >
            {p.texto}
          </button>
        ))}
      </div>

      {pestaña === 'progreso' && estadisticas && <PanelProgreso servicio={estadisticas} sala={sala} />}
      {pestaña === 'retos' && <PanelRetos servicio={servicio} sala={sala} />}
      {pestaña === 'ranking' && estadisticas && <TablaRanking servicio={estadisticas} salaId={sala.id} titulo="Ranking de la sala" />}

      <div className="overflow-hidden rounded-3xl bg-white shadow-[0_6px_0_0_rgba(0,0,0,0.15)]" hidden={pestaña !== 'vivo'}>
        {miembros.length === 0 ? (
          <p className="px-5 py-10 text-center text-indigo-500">
            Todavía no ha entrado nadie. Proyecta el código para que tus alumnos se unan.
          </p>
        ) : (
          <ul className="divide-y divide-indigo-100" aria-label="Alumnos de la sala">
            {miembros.map((m) => (
              <FilaMiembro
                key={m.usuario_id}
                miembro={m}
                alExpulsar={() =>
                  accion(async () => {
                    await servicio.expulsar(sala.id, m.usuario_id)
                    return `${m.nombre} ya no está en la sala.`
                  })
                }
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

export default PantallaSalaDocente
