import { describe, expect, it } from 'vitest'
import { EMPTY_RECORDS, createInitialState, submitAnswer } from './gameLogic'
import { createMemoryRepository, parseProgress } from './storage'

describe('récords', () => {
  it('guarda y carga', async () => {
    const repo = createMemoryRepository()
    await repo.saveRecords({ highScore: 120, maxLevel: 3 })
    expect((await repo.load()).records).toEqual({ highScore: 120, maxLevel: 3 })
  })

  it.each([
    ['sin datos', undefined],
    ['texto', '{oops'],
    ['tipos incorrectos', { highScore: '100', maxLevel: 2 }],
    ['negativos', { highScore: -5, maxLevel: 2 }],
    ['nivel fuera de rango', { highScore: 5, maxLevel: 9 }],
    ['array', [1, 2]],
  ])('devuelve récords vacíos con %s', (_, records) => {
    expect(parseProgress(records, null).records).toEqual(EMPTY_RECORDS)
  })
})

describe('partida guardada', () => {
  it('guarda y recupera exactamente el mismo estado', async () => {
    const repo = createMemoryRepository()
    let state = createInitialState(21)
    state = submitAnswer(state, state.equation.answer)
    state = submitAnswer(state, -1)
    await repo.saveGame(state)
    expect((await repo.load()).savedGame).toEqual(state)
  })

  it('clearSavedGame la elimina', async () => {
    const repo = createMemoryRepository()
    await repo.saveGame(createInitialState(1))
    await repo.clearSavedGame()
    expect((await repo.load()).savedGame).toBeNull()
  })

  it('las copias cargadas no modifican lo guardado', async () => {
    const repo = createMemoryRepository()
    await repo.saveGame(createInitialState(4))
    const loaded = (await repo.load()).savedGame!
    loaded.score = 999
    expect((await repo.load()).savedGame!.score).toBe(0)
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
    expect(parseProgress(null, data).savedGame).toBeNull()
  })
})
