import { useEffect, useState } from 'react'
import { useGameLogic } from '../../hooks/useGameLogic'
import { usePartidaReportada } from '../../hooks/usePartidaReportada'
import { mensajeDeError } from '../../supabase/errores'
import type { ServicioSalas } from '../../supabase/servicioSalas'
import type { EstadoSala, Sala, Usuario } from '../../supabase/tipos'
import { ICONO_TEMA, NOMBRE_TEMA, nivelInicialDeTema } from '../../utils/codigoSala'
import { routeToHash } from '../../utils/routes'
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
}

type Entrada = { estado: 'entrando' } | { estado: 'dentro'; sala: Sala } | { estado: 'error'; mensaje: string }

/**
 * Abrir #/salas/CÓDIGO une al alumno a la sala (si no estaba) y le deja jugar.
 * Así el enlace que comparte el docente sirve directamente de invitación.
 */
function PantallaSalaAlumno({ servicio, codigo, yo }: PantallaSalaAlumnoProps) {
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
  return <JuegoEnSala key={entrada.sala.id} servicio={servicio} sala={entrada.sala} yo={yo} />
}

function JuegoEnSala({ servicio, sala, yo }: { servicio: ServicioSalas; sala: Sala; yo: Usuario }) {
  const nivelInicial = nivelInicialDeTema(sala.tema)
  const base = useGameLogic({ initialLevel: nivelInicial })
  const { game, errorGuardado, logrosNuevos } = usePartidaReportada(base, { api: servicio, salaId: sala.id, nivelInicial })
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
      {(errorGuardado || estadoSala === 'cerrada') && (
        <p role="alert" className="max-w-md rounded-2xl bg-rose-900/40 px-4 py-2 text-center font-semibold text-rose-100">
          {estadoSala === 'cerrada' ? '🔒 La sala está cerrada: tus resultados ya no se envían.' : `⚠️ ${errorGuardado}`}
        </p>
      )}
      {logrosNuevos.length > 0 && (
        <div role="status" className="flex max-w-md animate-pop flex-col gap-1 rounded-2xl bg-amber-300 px-5 py-3 text-amber-950">
          <p className="font-bold">🏅 ¡Logro conseguido!</p>
          {logrosNuevos.map((l) => (
            <p key={l.id}>
              {l.icono} <strong>{l.nombre}</strong>: {l.descripcion}
            </p>
          ))}
        </div>
      )}

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
          <SecondaryButton onClick={salir} disabled={saliendo}>
            {saliendo ? '⏳ Saliendo…' : '🚪 Salir de la sala'}
          </SecondaryButton>
        }
      />
    </div>
  )
}

export default PantallaSalaAlumno
