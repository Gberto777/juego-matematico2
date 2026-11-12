import { useMemo } from 'react'
import { useAuth } from '../auth/contexto'
import { getFirebase } from '../firebase/app'
import { createFirestoreRepository } from '../firebase/gameRepository'
import { useGameLogic } from '../hooks/useGameLogic'
import { usePartidaReportada } from '../hooks/usePartidaReportada'
import type { ApiPartidas } from '../supabase/servicioSalas'
import type { RetoDiario } from '../supabase/tipos'
import { ICONO_TEMA, NOMBRE_TEMA, nivelInicialDeTema } from '../utils/codigoSala'
import AvisosPartida from './AvisosPartida'
import GameView from './GameView'
import SecondaryButton from './SecondaryButton'

interface SoloGameProps {
  /** Usuario de Firebase; null si no hay Firebase y se juega sin guardar. */
  uid: string | null
  onJoinClass: () => void
  onTeacher: () => void
  /** Supabase: con la sesión iniciada, cada partida se guarda (rankings, logros, perfil). */
  api?: ApiPartidas | null
  /** Partida del reto del día: empieza en su tema y se guarda en modo "diario". */
  diario?: RetoDiario
}

const claseEnlace =
  'rounded-full px-6 py-2 text-lg font-semibold text-white/90 ring-2 ring-white/40 transition-colors hover:bg-white/15 focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-white'

function SoloGame({ uid, onJoinClass, onTeacher, api = null, diario }: SoloGameProps) {
  const { auth } = useAuth()
  const conCuenta = auth.estado === 'sesion' && auth.usuario.activo
  // El reto del día no se mezcla con la partida individual guardada en Firebase.
  const repository = useMemo(() => (uid && !diario ? createFirestoreRepository(getFirebase().db, uid, 'solo') : null), [uid, diario])
  const nivelInicial = diario ? nivelInicialDeTema(diario.tema) : undefined
  const base = useGameLogic({ repository, initialLevel: nivelInicial })
  const { game, errorGuardado, logrosNuevos } = usePartidaReportada(base, {
    api: conCuenta ? api : null,
    modo: diario ? 'diario' : undefined,
    nivelInicial,
  })

  const acciones = api ? (
    <div className="flex flex-wrap justify-center gap-3">
      <a href="#/salas" className={claseEnlace}>
        🏫 Mis salas
      </a>
      <a href="#/ranking" className={claseEnlace}>
        🏆 Ranking
      </a>
      <a href="#/" className={claseEnlace}>
        ⬅ Inicio
      </a>
    </div>
  ) : (
    <div className="flex flex-wrap justify-center gap-3">
      <SecondaryButton onClick={onJoinClass}>🎒 Unirme a una clase</SecondaryButton>
      <SecondaryButton onClick={onTeacher}>👩‍🏫 Soy profesor</SecondaryButton>
    </div>
  )

  const nota =
    api && !game.isActive ? (
      <p className="text-center text-indigo-100">
        {conCuenta ? (
          '💾 Tus partidas se guardan en tu cuenta.'
        ) : (
          <>
            <a href="#/entrar" className="font-semibold text-white underline underline-offset-4">
              Entra con tu cuenta
            </a>{' '}
            para guardar tus partidas y ganar logros.
          </>
        )}
      </p>
    ) : null

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <AvisosPartida error={errorGuardado} logrosNuevos={logrosNuevos} />
      {diario && game.isActive && (
        <p className="rounded-full bg-white/15 px-5 py-2 font-semibold text-white" role="status">
          {game.totalCorrect >= diario.meta_aciertos
            ? '✅ ¡Reto del día cumplido! Termina la partida para guardarlo.'
            : `🎯 Reto del día: ${game.totalCorrect} de ${diario.meta_aciertos} aciertos`}
        </p>
      )}
      <GameView
        game={game}
        startBanner={
          diario && (
            <div className="flex flex-col items-center gap-1 rounded-3xl bg-white/15 px-6 py-3 text-white ring-1 ring-white/20">
              <span className="text-sm font-semibold tracking-widest text-amber-200 uppercase">🎯 Reto del día</span>
              <span className="text-lg">
                {ICONO_TEMA[diario.tema]} {NOMBRE_TEMA[diario.tema]}: consigue <strong>{diario.meta_aciertos} aciertos</strong> en una partida
              </span>
              {diario.completado && <span className="text-sm text-emerald-200">Ya lo cumpliste hoy. ¡Puedes mejorar tu marca!</span>}
            </div>
          )
        }
        startActions={
          <div className="flex flex-col items-center gap-4">
            {nota}
            {acciones}
          </div>
        }
      />
    </div>
  )
}

export default SoloGame
