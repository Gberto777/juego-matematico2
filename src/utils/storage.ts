import {
  EMPTY_RECORDS,
  INITIAL_LIVES,
  type AnswerResult,
  type GameRecords,
  type GameState,
} from './gameLogic'
import { MAX_LEVEL, calculate, isValidLevel, type Equation } from './mathUtils'

// --- Validación de datos leídos (pueden estar corruptos o haber sido editados a mano) ---

type UnknownRecord = Record<string, unknown>

const isObject = (v: unknown): v is UnknownRecord => typeof v === 'object' && v !== null && !Array.isArray(v)

const isNonNegativeInt = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0

export function isGameRecords(v: unknown): v is GameRecords {
  return (
    isObject(v) &&
    isNonNegativeInt(v.highScore) &&
    isNonNegativeInt(v.maxLevel) &&
    (v.maxLevel as number) <= MAX_LEVEL
  )
}

function isEquation(v: unknown): v is Equation {
  if (!isObject(v)) return false
  const { left, right, operator, text, answer } = v
  if (!Number.isInteger(left) || !Number.isInteger(right)) return false
  if (operator !== '+' && operator !== '-' && operator !== '×') return false
  return (
    answer === calculate(left as number, right as number, operator) && text === `${left} ${operator} ${right}`
  )
}

function isAnswerResult(v: unknown): v is AnswerResult {
  if (!isObject(v)) return false
  switch (v.kind) {
    case 'invalid':
      return true
    case 'incorrect':
      return Number.isInteger(v.expected) && Number.isInteger(v.given)
    case 'correct':
      return (
        Number.isInteger(v.expected) &&
        Number.isInteger(v.given) &&
        isNonNegativeInt(v.pointsEarned) &&
        typeof v.leveledUp === 'boolean'
      )
    default:
      return false
  }
}

/** Valida una partida guardada. Solo se consideran válidas partidas en curso. */
export function isSavedGame(v: unknown): v is GameState {
  return (
    isObject(v) &&
    v.status === 'playing' &&
    isEquation(v.equation) &&
    typeof v.level === 'number' &&
    isValidLevel(v.level) &&
    isNonNegativeInt(v.score) &&
    Number.isInteger(v.lives) &&
    (v.lives as number) >= 1 &&
    (v.lives as number) <= INITIAL_LIVES &&
    isNonNegativeInt(v.correctInLevel) &&
    isNonNegativeInt(v.totalCorrect) &&
    isNonNegativeInt(v.totalAnswered) &&
    (v.totalCorrect as number) <= (v.totalAnswered as number) &&
    (v.lastResult === null || isAnswerResult(v.lastResult)) &&
    isNonNegativeInt(v.seed) &&
    isGameRecords(v.records) &&
    isNonNegativeInt(v.previousHighScore)
  )
}

// --- API pública ---

/** Datos persistidos de un jugador: récords y, si la hay, la partida en curso. */
export interface StoredProgress {
  records: GameRecords
  savedGame: GameState | null
}

/**
 * Dónde se guardan récords y partida en curso. Es asíncrono porque la implementación
 * real es Firestore (ver src/firebase/gameRepository.ts); en tests se usa la de memoria.
 */
export interface GameRepository {
  load(): Promise<StoredProgress>
  saveRecords(records: GameRecords): Promise<void>
  saveGame(state: GameState): Promise<void>
  clearSavedGame(): Promise<void>
}

/** Normaliza datos leídos del almacenamiento: lo que no sea válido se descarta. */
export function parseProgress(records: unknown, savedGame: unknown): StoredProgress {
  return {
    records: isGameRecords(records) ? records : EMPTY_RECORDS,
    savedGame: isSavedGame(savedGame) ? savedGame : null,
  }
}

/** Repositorio en memoria (tests y modo sin conexión a Firebase dentro de una misma sesión). */
export function createMemoryRepository(initial: { records?: unknown; savedGame?: unknown } = {}) {
  const data = { records: initial.records ?? null, savedGame: initial.savedGame ?? null }
  const repository: GameRepository & { data: typeof data } = {
    data,
    load: async () => parseProgress(structuredClone(data.records), structuredClone(data.savedGame)),
    saveRecords: async (records) => {
      data.records = structuredClone(records)
    },
    saveGame: async (state) => {
      data.savedGame = structuredClone(state)
    },
    clearSavedGame: async () => {
      data.savedGame = null
    },
  }
  return repository
}
