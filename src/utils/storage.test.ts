import { describe, expect, it } from 'vitest'
import { EMPTY_RECORDS, createInitialState, submitAnswer } from './gameLogic'
import {
  RECORDS_KEY,
  SAVED_GAME_KEY,
  clearSavedGame,
  loadRecords,
  loadSavedGame,
  saveGame,
  saveRecords,
  type KeyValueStorage,
} from './storage'

function memoryStorage(initial: Record<string, string> = {}): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial))
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  }
}

const throwingStorage: KeyValueStorage = {
  getItem: () => {
    throw new Error('bloqueado')
  },
  setItem: () => {
    throw new Error('cuota llena')
  },
  removeItem: () => {
    throw new Error('bloqueado')
  },
}

describe('récords', () => {
  it('guarda y carga', () => {
    const storage = memoryStorage()
    saveRecords(storage, { highScore: 120, maxLevel: 3 })
    expect(loadRecords(storage)).toEqual({ highScore: 120, maxLevel: 3 })
  })

  it.each([
    ['sin datos', undefined],
    ['JSON roto', '{oops'],
    ['tipos incorrectos', '{"highScore":"100","maxLevel":2}'],
    ['negativos', '{"highScore":-5,"maxLevel":2}'],
    ['nivel fuera de rango', '{"highScore":5,"maxLevel":9}'],
    ['array', '[1,2]'],
  ])('devuelve récords vacíos con %s', (_, raw) => {
    const storage = memoryStorage(raw === undefined ? {} : { [RECORDS_KEY]: raw })
    expect(loadRecords(storage)).toEqual(EMPTY_RECORDS)
  })

  it('funciona sin almacenamiento disponible', () => {
    expect(loadRecords(null)).toEqual(EMPTY_RECORDS)
    expect(() => saveRecords(null, EMPTY_RECORDS)).not.toThrow()
    expect(loadRecords(throwingStorage)).toEqual(EMPTY_RECORDS)
    expect(() => saveRecords(throwingStorage, EMPTY_RECORDS)).not.toThrow()
  })
})

describe('partida guardada', () => {
  it('guarda y recupera exactamente el mismo estado', () => {
    const storage = memoryStorage()
    let state = createInitialState(21)
    state = submitAnswer(state, state.equation.answer)
    state = submitAnswer(state, -1)
    saveGame(storage, state)
    expect(loadSavedGame(storage)).toEqual(state)
  })

  it('clearSavedGame la elimina', () => {
    const storage = memoryStorage()
    saveGame(storage, createInitialState(1))
    clearSavedGame(storage)
    expect(loadSavedGame(storage)).toBeNull()
  })

  it('descarta y limpia datos corruptos', () => {
    const storage = memoryStorage({ [SAVED_GAME_KEY]: '{"score": 10' })
    expect(loadSavedGame(storage)).toBeNull()
    expect(storage.data.has(SAVED_GAME_KEY)).toBe(false)
  })

  const valid = createInitialState(3)
  it.each([
    ['partida terminada', { ...valid, status: 'game-over', lives: 0 }],
    ['sin vidas', { ...valid, lives: 0 }],
    ['vidas de más', { ...valid, lives: 99 }],
    ['nivel inválido', { ...valid, level: 7 }],
    ['puntuación negativa', { ...valid, score: -10 }],
    ['respuesta manipulada', { ...valid, equation: { ...valid.equation, answer: valid.equation.answer + 1 } }],
    ['operador desconocido', { ...valid, equation: { ...valid.equation, operator: '/' } }],
    ['más aciertos que respuestas', { ...valid, totalCorrect: 5, totalAnswered: 2 }],
    ['último resultado inválido', { ...valid, lastResult: { kind: 'otro' } }],
    ['sin récords', { ...valid, records: undefined }],
  ])('rechaza: %s', (_, data) => {
    const storage = memoryStorage({ [SAVED_GAME_KEY]: JSON.stringify(data) })
    expect(loadSavedGame(storage)).toBeNull()
  })

  it('funciona sin almacenamiento disponible', () => {
    expect(loadSavedGame(throwingStorage)).toBeNull()
    expect(() => saveGame(throwingStorage, valid)).not.toThrow()
    expect(() => clearSavedGame(throwingStorage)).not.toThrow()
  })
})
