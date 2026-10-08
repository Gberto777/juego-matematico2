import { useEffect, useRef } from 'react'
import { getFirebase } from '../firebase/app'
import { reportProgress, type ProgressReport } from '../firebase/rooms'
import type { Player, PlayerStatus } from '../utils/room'
import type { UseGameLogicResult } from './useGameLogic'

/**
 * Envía a `rooms/{code}/players/{uid}` las métricas de la partida cada vez que cambian
 * (una escritura por respuesta), para que el panel del profesor se actualice en tiempo real.
 */
export function useRoomReporter(code: string, uid: string, player: Player, game: UseGameLogicResult): void {
  const { isLoading, isActive, isGameOver, score, level, lives, totalCorrect, totalAnswered } = game
  const lastSent = useRef<string | null>(null)
  const lastStatus = useRef<PlayerStatus>(player.status)
  const best = useRef({ bestScore: player.bestScore, bestLevel: player.bestLevel })

  useEffect(() => {
    if (isLoading) return
    const status: PlayerStatus = !isActive ? 'waiting' : isGameOver ? 'finished' : 'playing'
    const progress: ProgressReport = { status, score, level, lives, totalCorrect, totalAnswered }

    const key = JSON.stringify(progress)
    if (key === lastSent.current) return
    lastSent.current = key

    // Solo se suma a los acumulados en la transición a "terminada", una vez por partida.
    const justFinished = status === 'finished' && lastStatus.current !== 'finished'
    lastStatus.current = status
    if (justFinished) {
      best.current = {
        bestScore: Math.max(best.current.bestScore, score),
        bestLevel: Math.max(best.current.bestLevel, level),
      }
    }

    reportProgress(getFirebase().db, code, uid, progress, justFinished ? best.current : undefined).catch(
      (error: unknown) => console.warn('No se pudieron enviar las métricas a la sala', error),
    )
  }, [code, uid, isLoading, isActive, isGameOver, score, level, lives, totalCorrect, totalAnswered])
}
