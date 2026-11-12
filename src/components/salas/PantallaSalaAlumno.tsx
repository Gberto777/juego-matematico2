import { useCallback, useEffect, useState } from 'react'
import { useCarga } from '../../hooks/useCarga'
import { useGameLogic } from '../../hooks/useGameLogic'
import { usePartidaReportada } from '../../hooks/usePartidaReportada'
import { mensajeDeError } from '../../supabase/errores'
import type { ServicioEstadisticas } from '../../supabase/servicioEstadisticas'
import type { ServicioSalas } from '../../supabase/servicioSalas'
import type { EstadoSala, RetoConProgreso, Sala, Usuario } from '../../supabase/tipos'
import { plazo } from '../../utils/retos'
import { Panel, SegunCarga } from '../estadisticas/Comunes'
import { TablaRanking } from '../estadisticas/Ranking'
import { ICONO_TEMA, NOMBRE_TEMA, nivelInicialDeTema } from '../../utils/codigoSala'
import { routeToHash } from '../../utils/routes'
import AvisosPartida from '../AvisosPartida'
import GameView from '../GameView'
import SecondaryButton from '../SecondaryButton'
import StatusMessage from '../StatusMessage'
import { EnlaceTexto } from '../cuenta/Formulario'

/** Cada cuánto el alumno avisa de que sigue conectado (el docente lo ve "conectado" 2 minutos). */
export const LATIDO_MS = 30_000

interface PantallaSalaAlumnoProps {
  servicio: ServicioSalas
  codigo: string
  yo: Usuario
  /** Para el ranking de la sala (opcional). */
  estadisticas?: ServicioEstadisticas | null
}

type Entrada = { estado: 'entrando' } | { estado: 'dentro'; sala: Sala } | { estado: 'error'; mensaje: string }

/**
 * Abrir #/salas/CÓDIGO une al alumno a la sala (si no estaba) y le deja jugar.
 * Así el enlace que comparte el docente sirve directamente de invitación.
 */
function PantallaSalaAlumno({ servicio, codigo, yo, estadisticas = null }: PantallaSalaAlumnoProps) {
  const [entrada, setEntrada] = useState<Entrada>({ estado: 'entrando' })

  useEffect(() => {
    let cancelado = false
    servicio.unirse(codigo).then(
      (sala) => !cancelado && setEntrada({ estado: 'dentro', sala }),
      (error: unknown) => {
        console.error(error)
        if (!cancelado) setEntrada({ estado: 'error', mensaje: mensajeDeError(error, 'No se pudo entrar a la sala.') })
      },
    )
    return () => {
      cancelado = true
    }
  }, [servicio, codigo])

  if (entrada.estado === 'entrando') return <StatusMessage icon="⏳" title="Entrando a la sala…" />
  if (entrada.estado === 'error') {
    return (
      <StatusMessage icon="🚪" title="No pudiste entrar">
        <p>{entrada.mensaje}</p>
        <EnlaceTexto href="#/salas">⬅ Mis salas</EnlaceTexto>
      </StatusMessage>
    )
  }
  if (entrada.sala.docente_id === yo.id) {
    return (
      <StatusMessage icon="👩‍🏫" title="Esta sala es tuya">
        <p>Los docentes siguen la sala desde su panel. Comparte este enlace o el código con tus alumnos.</p>
        <EnlaceTexto href={routeToHash({ name: 'teacherRoom', code: entrada.sala.codigo })}>📊 Abrir el panel de la sala</EnlaceTexto>
      </StatusMessage>
    )
  }
  return <JuegoEnSala key={entrada.sala.id} servicio={servicio} sala={entrada.sala} yo={yo} estadisticas={estadisticas} />
}

interface JuegoEnSalaProps {
  servicio: ServicioSalas
  sala: Sala
  yo: Usuario
  estadisticas: ServicioEstadisticas | null
}

function JuegoEnSala({ servicio, sala, yo, estadisticas }: JuegoEnSalaProps) {
  // Con un reto elegido, la partida cuenta para ese reto y empieza en su tema.
  const [reto, setReto] = useState<RetoConProgreso | null>(null)
  const [pedidos, setPedidos] = useState(0)
  const nivelInicial = nivelInicialDeTema(reto?.tema ?? sala.tema)
  const base = useGameLogic({ initialLevel: nivelInicial })
  const { game, errorGuardado, logrosNuevos } = usePartidaReportada(base, {
    api: servicio,
    salaId: sala.id,
    retoId: reto?.id,
    nivelInicial,
  })
  const [retos, recargarRetos] = useCarga(useCallback(() => servicio.retos(sala.id), [servicio, sala.id]))
  // Al terminar una partida, el progreso en los retos puede haber cambiado.
  useEffect(() => {
    if (game.isGameOver) recargarRetos()
  }, [game.isGameOver, recargarRetos])

  // Empezar un reto: primero se elige (cambia el nivel y el reto de la partida) y luego se empieza.
  const { startGame } = game
  useEffect(() => {
    if (pedidos > 0) startGame()
  }, [pedidos]) // eslint-disable-line react-hooks/exhaustive-deps -- solo al pedirlo
  const [estadoSala, setEstadoSala] = useState<EstadoSala | 'fuera'>(sala.estado)
  const [saliendo, setSaliendo] = useState(false)

  useEffect(() => {
    let cancelado = false
    const latir = () =>
      servicio.latido(sala.id).then(
        (estado) => !cancelado && setEstadoSala(estado ?? 'fuera'),
        (error: unknown) => console.warn('No se pudo avisar de la conexión', error),
      )
    void latir()
    const intervalo = setInterval(latir, LATIDO_MS)
    return () => {
      cancelado = true
      clearInterval(intervalo)
    }
  }, [servicio, sala.id])

  if (estadoSala === 'fuera') {
    return (
      <StatusMessage icon="👋" title="Ya no estás en esta sala">
        <p>Tu docente te quitó de la sala. Si fue un error, vuelve a entrar con el código.</p>
        <EnlaceTexto href="#/salas">⬅ Mis salas</EnlaceTexto>
      </StatusMessage>
    )
  }

  const salir = () => {
    setSaliendo(true)
    servicio.salir(sala.id, yo.id).then(
      () => {
        window.location.hash = '#/salas'
      },
      (error: unknown) => {
        console.error(error)
        setSaliendo(false)
      },
    )
  }

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <AvisosPartida
        error={estadoSala === 'cerrada' ? 'La sala está cerrada: tus resultados ya no se envían.' : errorGuardado}
        logrosNuevos={logrosNuevos}
      />

      <GameView
        game={game}
        startBanner={
          <div className="flex flex-col items-center gap-1 rounded-3xl bg-white/15 px-6 py-3 text-white ring-1 ring-white/20 backdrop-blur">
            <span className="text-sm font-semibold tracking-widest text-amber-200 uppercase">
              🏫 {sala.nombre} · <span className="font-mono">{sala.codigo}</span>
            </span>
            <span className="text-lg">
              {ICONO_TEMA[sala.tema]} {NOMBRE_TEMA[sala.tema]} · Jugando como <strong>{yo.nombre}</strong>
            </span>
          </div>
        }
        startActions={
          <div className="flex flex-col items-center gap-3">
            {reto && (
              <p className="rounded-full bg-amber-300 px-5 py-2 font-semibold text-amber-950">
                🎯 Reto: {reto.titulo} · meta {reto.meta_aciertos} aciertos{' '}
                <button type="button" onClick={() => setReto(null)} className="ml-2 underline underline-offset-2">
                  Jugar sin reto
                </button>
              </p>
            )}
            <SecondaryButton onClick={salir} disabled={saliendo}>
              {saliendo ? '⏳ Saliendo…' : '🚪 Salir de la sala'}
            </SecondaryButton>
          </div>
        }
      />

      {game.isActive && reto && (
        <p className="rounded-full bg-white/15 px-5 py-2 font-semibold text-white" role="status">
          🎯 {reto.titulo}: {game.totalCorrect} de {reto.meta_aciertos} aciertos
        </p>
      )}

      {!game.isActive && (
        <div className="grid w-full max-w-5xl gap-5 lg:grid-cols-2">
          <Panel titulo="Retos de tu docente">
            <SegunCarga carga={retos} recargar={recargarRetos}>
              {(lista) =>
                lista.length === 0 ? (
                  <p className="text-indigo-500">Tu docente todavía no ha puesto retos en esta sala.</p>
                ) : (
                  <ul className="flex flex-col gap-3" aria-label="Retos de la sala">
                    {lista.map((r) => (
                      <li key={r.id} className={`rounded-2xl p-4 ${r.cumplido_por_mi ? 'bg-emerald-50' : 'bg-indigo-50/60'}`}>
                        <p className="font-bold">
                          {ICONO_TEMA[r.tema]} {r.titulo}
                        </p>
                        <p className="text-sm text-indigo-600">
                          {r.meta_aciertos} aciertos · {plazo(r)}
                        </p>
                        {r.descripcion && <p className="mt-1 text-sm">{r.descripcion}</p>}
                        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                          <span className="text-sm font-semibold">
                            {r.cumplido_por_mi ? '✅ ¡Cumplido!' : `Tu mejor: ${r.mi_mejor} de ${r.meta_aciertos}`}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setReto(r)
                              setPedidos((n) => n + 1)
                            }}
                            aria-label={`Jugar el reto ${r.titulo}`}
                            className="rounded-full bg-indigo-600 px-4 py-1.5 text-sm font-bold text-white hover:bg-indigo-500"
                          >
                            ▶ Jugar
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )
              }
            </SegunCarga>
          </Panel>
          {estadisticas && <TablaRanking servicio={estadisticas} salaId={sala.id} titulo="Ranking de la sala" />}
        </div>
      )}
    </div>
  )
}

export default PantallaSalaAlumno
