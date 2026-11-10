import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ReportadorPartida } from '../juego/reportadorPartida'
import { mensajeDeError } from '../supabase/errores'
import type { ApiPartidas } from '../supabase/servicioSalas'
import type { Logro, ModoPartida } from '../supabase/tipos'
import { parseAnswer, type Level } from '../utils/mathUtils'
import type { UseGameLogicResult } from './useGameLogic'

interface Opciones {
  /** null: no se guarda nada (sin Supabase o sin sesión). */
  api: ApiPartidas | null
  salaId?: string
  /** Partida de un reto del docente. */
  retoId?: string
  modo?: ModoPartida
  /** Nivel con el que se empieza si startGame() no indica otro. */
  nivelInicial?: Level
}

export interface PartidaReportada {
  /** El mismo juego, con las acciones envueltas para enviar la partida a Supabase. */
  game: UseGameLogicResult
  /** Mensaje si algo no se pudo guardar (el juego sigue funcionando). */
  errorGuardado: string | null
  /** Logros conseguidos al terminar la última partida. */
  logrosNuevos: Logro[]
}

/**
 * Guarda en Supabase las partidas del juego web: cada respuesta (operación y número elegido)
 * y el progreso tras cada una, para que el docente lo vea en vivo y cuenten para logros y rankings.
 */
export function usePartidaReportada(
  game: UseGameLogicResult,
  { api, salaId, retoId, modo, nivelInicial }: Opciones,
): PartidaReportada {
  const [errorGuardado, setErrorGuardado] = useState<string | null>(null)
  const [logrosNuevos, setLogrosNuevos] = useState<Logro[]>([])

  const reportador = useMemo(
    () =>
      api &&
      new ReportadorPartida(api, {
        alFallar: (error) => setErrorGuardado(mensajeDeError(error, 'No se pudo guardar tu partida.')),
        alGanarLogros: setLogrosNuevos,
      }),
    [api],
  )

  // Momento en que apareció la pregunta actual, para medir cuánto se tardó en responder.
  const inicioPregunta = useRef(0)
  useEffect(() => {
    inicioPregunta.current = Date.now()
  }, [game.equation])

  const { startGame, submitAnswer, goToMenu, status, isActive, equation } = game

  const empezar = useCallback(
    (level?: Level) => {
      const nivel = level ?? nivelInicial ?? 1
      setErrorGuardado(null)
      setLogrosNuevos([])
      reportador?.iniciar({ origen: 'web', nivelInicial: nivel, salaId, retoId, modo })
      startGame(nivel)
    },
    [reportador, salaId, retoId, modo, nivelInicial, startGame],
  )

  const responder = useCallback(
    (answer: string | number) => {
      const valor = parseAnswer(answer)
      // Las respuestas vacías no cuentan en el juego, así que tampoco se envían.
      if (reportador && isActive && status === 'playing' && valor !== null) {
        reportador.responder(equation, valor, Date.now() - inicioPregunta.current)
      }
      submitAnswer(answer)
    },
    [reportador, isActive, status, equation, submitAnswer],
  )

  const alMenu = useCallback(() => {
    if (status === 'playing') reportador?.descartar()
    goToMenu()
  }, [reportador, status, goToMenu])

  // Tras cada respuesta, el estado nuevo (o el final, si se perdió la última vida).
  const { totalAnswered, score, level, lives, isGameOver } = game
  const ultimaEnviada = useRef(totalAnswered)
  useEffect(() => {
    if (!reportador || !isActive || totalAnswered === ultimaEnviada.current) return
    ultimaEnviada.current = totalAnswered
    if (totalAnswered === 0) return // Partida nueva: aún no hay nada que enviar.
    reportador.progreso({ puntos: score, nivel: level, vidas: lives }, isGameOver)
  }, [reportador, isActive, totalAnswered, score, level, lives, isGameOver])

  const juego = useMemo(
    () => ({ ...game, startGame: empezar, resetGame: empezar, submitAnswer: responder, goToMenu: alMenu }),
    [game, empezar, responder, alMenu],
  )

  return { game: juego, errorGuardado, logrosNuevos }
}
