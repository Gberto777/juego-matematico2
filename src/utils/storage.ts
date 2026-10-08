import {
  EMPTY_RECORDS,
  INITIAL_LIVES,
  type AnswerResult,
  type GameRecords,
  type GameState,
} from './gameLogic'
import { MAX_LEVEL, calculate, isValidLevel, type Equation } from './mathUtils'

/** Subconjunto de la API de Storage que usamos (permite inyectar un doble en tests). */
export type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export const RECORDS_KEY = 'juego-matematico:records:v1'
export const SAVED_GAME_KEY = 'juego-matematico:partida:v1'

/** localStorage si está disponible (puede lanzar en modo privado o con cookies bloqueadas). */
export function getDefaultStorage(): KeyValueStorage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null
  } catch {
    return null
  }
}

function readJson(storage: KeyValueStorage | null, key: string): unknown {
  if (!storage) return null
  try {
    const raw = storage.getItem(key)
    return raw === null ? null : JSON.parse(raw)
  } catch {
    return null
  }
}

function writeJson(storage: KeyValueStorage | null, key: string, value: unknown): void {
  try {
    storage?.setItem(key, JSON.stringify(value))
  } catch {
    // Cuota llena o almacenamiento bloqueado: el juego sigue funcionando sin guardar.
  }
}

function remove(storage: KeyValueStorage | null, key: string): void {
  try {
    storage?.removeItem(key)
  } catch {
    // Ignorado por la misma razón que en writeJson.
  }
}

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

export function loadRecords(storage: KeyValueStorage | null): GameRecords {
  const value = readJson(storage, RECORDS_KEY)
  return isGameRecords(value) ? value : EMPTY_RECORDS
}

export function saveRecords(storage: KeyValueStorage | null, records: GameRecords): void {
  writeJson(storage, RECORDS_KEY, records)
}

/** Devuelve la partida en curso guardada, o null si no hay ninguna válida (y limpia la corrupta). */
export function loadSavedGame(storage: KeyValueStorage | null): GameState | null {
  const value = readJson(storage, SAVED_GAME_KEY)
  if (isSavedGame(value)) return value
  // Ausente, JSON roto o datos inválidos: se elimina para no volver a intentarlo.
  remove(storage, SAVED_GAME_KEY)
  return null
}

export function saveGame(storage: KeyValueStorage | null, state: GameState): void {
  writeJson(storage, SAVED_GAME_KEY, state)
}

export function clearSavedGame(storage: KeyValueStorage | null): void {
  remove(storage, SAVED_GAME_KEY)
}
