import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import {
  EMPTY_RECORDS,
  createInitialState,
  gameReducer,
  isNewHighScore,
  updateRecords,
  type AnswerResult,
  type GameRecords,
  type GameState,
  type GameStatus,
} from '../utils/gameLogic'
import { randomSeed, type Equation, type Level } from '../utils/mathUtils'
import type { GameRepository, StoredProgress } from '../utils/storage'

export interface UseGameLogicOptions {
  /** Nivel con el que empieza la partida (por defecto 1). */
  initialLevel?: Level
  /** Semilla fija para partidas reproducibles (útil en tests). */
  seed?: number
  /**
   * Dónde guardar récords y partida en curso (Firestore en la app). Sin repositorio
   * no se persiste nada. Debe ser estable entre renders (memoizado).
   */
  repository?: GameRepository | null
}

export interface UseGameLogicResult {
  equation: Equation
  correctAnswer: number
  level: Level
  score: number
  lives: number
  status: GameStatus
  isGameOver: boolean
  /** true mientras hay una partida empezada (en curso o recién terminada). */
  isActive: boolean
  /** true si la partida en curso se recuperó del almacenamiento al cargar la página. */
  wasRestored: boolean
  /** true mientras se cargan récords y partida guardada; no se debe empezar a jugar aún. */
  isLoading: boolean
  correctInLevel: number
  totalCorrect: number
  totalAnswered: number
  lastResult: AnswerResult | null
  records: GameRecords
  isNewHighScore: boolean
  /** Empieza una partida nueva (opcionalmente en otro nivel). */
  startGame: (level?: Level) => void
  /** Valida la respuesta del usuario: suma puntos/sube de nivel si acierta, resta una vida si falla. */
  submitAnswer: (answer: string | number) => void
  /** Reinicia la partida (opcionalmente en otro nivel). Equivale a startGame. */
  resetGame: (level?: Level) => void
  /** Vuelve a la pantalla de inicio descartando la partida actual. */
  goToMenu: () => void
}

/** Estado con el que arranca el juego una vez leído el almacenamiento. */
function stateFromProgress({ records, savedGame }: StoredProgress, seed?: number, level?: Level): GameState {
  if (savedGame) {
    // Los récords guardados aparte prevalecen si son mayores que los de la partida.
    const merged = updateRecords(records, savedGame.records.highScore, savedGame.records.maxLevel)
    return { ...savedGame, records: merged }
  }
  return createInitialState(seed ?? randomSeed(), level, records)
}

export function useGameLogic({ initialLevel, seed, repository = null }: UseGameLogicOptions = {}): UseGameLogicResult {
  const [state, dispatch] = useReducer(gameReducer, undefined, () =>
    createInitialState(seed ?? randomSeed(), initialLevel, EMPTY_RECORDS),
  )
  const [isActive, setIsActive] = useState(false)
  const [wasRestored, setWasRestored] = useState(false)
  const [isLoading, setIsLoading] = useState(repository !== null)
  // Último valor escrito (o leído) en el repositorio, para no repetir escrituras idénticas.
  const persisted = useRef<{ records: GameRecords | null; game: GameState | null }>({ records: null, game: null })
  // seed e initialLevel solo importan en la carga inicial.
  const initialOptions = useRef({ seed, initialLevel })

  useEffect(() => {
    if (!repository) return
    let cancelled = false
    repository
      .load()
      .catch((error: unknown): StoredProgress => {
        console.warn('No se pudo cargar el progreso guardado', error)
        return { records: EMPTY_RECORDS, savedGame: null }
      })
      .then((progress) => {
        if (cancelled) return
        const loaded = stateFromProgress(progress, initialOptions.current.seed, initialOptions.current.initialLevel)
        const restored = progress.savedGame !== null
        persisted.current = { records: loaded.records, game: restored ? loaded : null }
        dispatch({ type: 'load', state: loaded })
        setIsActive(restored)
        setWasRestored(restored)
        setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [repository])

  useEffect(() => {
    if (!repository || isLoading || persisted.current.records === state.records) return
    persisted.current.records = state.records
    repository.saveRecords(state.records).catch((error: unknown) => console.warn('No se pudieron guardar los récords', error))
  }, [repository, isLoading, state.records])

  useEffect(() => {
    if (!repository || isLoading) return
    // Sin partida activa o con la partida terminada no hay nada que recuperar.
    const game = isActive && state.status === 'playing' ? state : null
    if (persisted.current.game === game) return
    persisted.current.game = game
    const write = game ? repository.saveGame(game) : repository.clearSavedGame()
    write.catch((error: unknown) => console.warn('No se pudo guardar la partida', error))
  }, [repository, isLoading, state, isActive])

  const startGame = useCallback(
    (level?: Level) => {
      dispatch({ type: 'reset', seed: randomSeed(), level: level ?? initialLevel })
      setIsActive(true)
      setWasRestored(false)
    },
    [initialLevel],
  )

  const goToMenu = useCallback(() => {
    setIsActive(false)
    setWasRestored(false)
  }, [])

  const submitAnswer = useCallback((answer: string | number) => {
    dispatch({ type: 'submit-answer', answer })
  }, [])

  return {
    equation: state.equation,
    correctAnswer: state.equation.answer,
    level: state.level,
    score: state.score,
    lives: state.lives,
    status: state.status,
    isGameOver: state.status === 'game-over',
    isActive,
    wasRestored,
    isLoading,
    correctInLevel: state.correctInLevel,
    totalCorrect: state.totalCorrect,
    totalAnswered: state.totalAnswered,
    lastResult: state.lastResult,
    records: state.records,
    isNewHighScore: isNewHighScore(state),
    startGame,
    submitAnswer,
    resetGame: startGame,
    goToMenu,
  }
}
