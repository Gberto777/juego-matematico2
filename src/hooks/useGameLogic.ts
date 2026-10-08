import { useCallback, useEffect, useReducer, useState } from 'react'
import {
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
import {
  clearSavedGame,
  getDefaultStorage,
  loadRecords,
  loadSavedGame,
  saveGame,
  saveRecords,
  type KeyValueStorage,
} from '../utils/storage'

export interface UseGameLogicOptions {
  /** Nivel con el que empieza la partida (por defecto 1). */
  initialLevel?: Level
  /** Semilla fija para partidas reproducibles (útil en tests). */
  seed?: number
  /**
   * Dónde guardar récords y partida en curso. Por defecto localStorage;
   * `null` desactiva la persistencia.
   */
  storage?: KeyValueStorage | null
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

interface InitialGame {
  state: GameState
  restored: boolean
}

function loadInitialGame(storage: KeyValueStorage | null, seed?: number, level?: Level): InitialGame {
  const records = loadRecords(storage)
  const saved = loadSavedGame(storage)
  if (saved) {
    // Los récords guardados aparte prevalecen si son mayores que los de la partida.
    const merged = updateRecords(records, saved.records.highScore, saved.records.maxLevel)
    return { state: { ...saved, records: merged }, restored: true }
  }
  return { state: createInitialState(seed ?? randomSeed(), level, records), restored: false }
}

export function useGameLogic({
  initialLevel,
  seed,
  storage: storageOption,
}: UseGameLogicOptions = {}): UseGameLogicResult {
  const storage = storageOption === undefined ? getDefaultStorage() : storageOption

  // Se calcula una sola vez: el estado inicial y si venía de una partida guardada.
  const [initial] = useState(() => loadInitialGame(storage, seed, initialLevel))
  const [state, dispatch] = useReducer(gameReducer, initial.state)
  const [isActive, setIsActive] = useState(initial.restored)
  const [wasRestored, setWasRestored] = useState(initial.restored)

  useEffect(() => {
    saveRecords(storage, state.records)
  }, [storage, state.records])

  useEffect(() => {
    if (isActive && state.status === 'playing') {
      saveGame(storage, state)
    } else {
      // Sin partida activa o con la partida terminada no hay nada que recuperar.
      clearSavedGame(storage)
    }
  }, [storage, state, isActive])

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
