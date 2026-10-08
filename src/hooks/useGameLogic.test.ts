// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { INITIAL_LIVES } from '../utils/gameLogic'
import { RECORDS_KEY, SAVED_GAME_KEY } from '../utils/storage'
import { useGameLogic } from './useGameLogic'

beforeEach(() => {
  localStorage.clear()
})

describe('useGameLogic', () => {
  it('expone el estado inicial', () => {
    const { result } = renderHook(() => useGameLogic({ seed: 1 }))
    expect(result.current).toMatchObject({
      level: 1,
      score: 0,
      lives: INITIAL_LIVES,
      isGameOver: false,
      isActive: false,
      wasRestored: false,
      records: { highScore: 0, maxLevel: 0 },
    })
    expect(result.current.correctAnswer).toBe(result.current.equation.answer)
  })

  it('valida respuestas correctas e incorrectas', () => {
    const { result } = renderHook(() => useGameLogic({ seed: 1 }))
    act(() => result.current.startGame())

    act(() => result.current.submitAnswer(result.current.correctAnswer))
    expect(result.current.score).toBe(10)

    act(() => result.current.submitAnswer(String(result.current.correctAnswer + 1)))
    expect(result.current.lives).toBe(INITIAL_LIVES - 1)
    expect(result.current.lastResult?.kind).toBe('incorrect')
  })

  it('llega a game over y se puede reiniciar', () => {
    const { result } = renderHook(() => useGameLogic({ seed: 1, initialLevel: 3 }))
    act(() => result.current.startGame())
    for (let i = 0; i < INITIAL_LIVES; i++) {
      act(() => result.current.submitAnswer(-1))
    }
    expect(result.current.isGameOver).toBe(true)
    expect(result.current.isActive).toBe(true)

    act(() => result.current.resetGame())
    expect(result.current).toMatchObject({ level: 3, lives: INITIAL_LIVES, score: 0, isGameOver: false })
  })

  it('mantiene referencias estables de las funciones', () => {
    const { result, rerender } = renderHook(() => useGameLogic({ seed: 1 }))
    const { submitAnswer, startGame } = result.current
    rerender()
    expect(result.current.submitAnswer).toBe(submitAnswer)
    expect(result.current.startGame).toBe(startGame)
  })
})

describe('useGameLogic: persistencia', () => {
  it('guarda los récords en localStorage y los recupera', () => {
    const first = renderHook(() => useGameLogic())
    act(() => first.result.current.startGame())
    act(() => first.result.current.submitAnswer(first.result.current.correctAnswer))
    act(() => first.result.current.submitAnswer(first.result.current.correctAnswer))
    expect(JSON.parse(localStorage.getItem(RECORDS_KEY)!)).toEqual({ highScore: 20, maxLevel: 1 })
    first.unmount()

    const second = renderHook(() => useGameLogic())
    expect(second.result.current.records).toEqual({ highScore: 20, maxLevel: 1 })
  })

  it('recupera la partida en curso tras recargar', () => {
    const first = renderHook(() => useGameLogic())
    act(() => first.result.current.startGame())
    act(() => first.result.current.submitAnswer(first.result.current.correctAnswer))
    act(() => first.result.current.submitAnswer(-1))
    const before = first.result.current
    first.unmount()

    const second = renderHook(() => useGameLogic())
    expect(second.result.current).toMatchObject({
      isActive: true,
      wasRestored: true,
      score: before.score,
      lives: before.lives,
      level: before.level,
      equation: before.equation,
      totalAnswered: 2,
    })

    // Se puede seguir jugando con normalidad.
    act(() => second.result.current.submitAnswer(second.result.current.correctAnswer))
    expect(second.result.current.score).toBe(before.score + 10)
  })

  it('no guarda partida si no se ha empezado', () => {
    renderHook(() => useGameLogic())
    expect(localStorage.getItem(SAVED_GAME_KEY)).toBeNull()
  })

  it('borra la partida guardada al terminar, pero conserva los récords', () => {
    const first = renderHook(() => useGameLogic())
    act(() => first.result.current.startGame())
    act(() => first.result.current.submitAnswer(first.result.current.correctAnswer))
    expect(localStorage.getItem(SAVED_GAME_KEY)).not.toBeNull()
    for (let i = 0; i < INITIAL_LIVES; i++) {
      act(() => first.result.current.submitAnswer(-1))
    }
    expect(first.result.current.isNewHighScore).toBe(true)
    expect(localStorage.getItem(SAVED_GAME_KEY)).toBeNull()
    first.unmount()

    const second = renderHook(() => useGameLogic())
    expect(second.result.current).toMatchObject({ isActive: false, records: { highScore: 10, maxLevel: 1 } })
  })

  it('una nueva partida ya no se marca como recuperada', () => {
    const first = renderHook(() => useGameLogic())
    act(() => first.result.current.startGame())
    first.unmount()

    const second = renderHook(() => useGameLogic())
    expect(second.result.current.wasRestored).toBe(true)
    act(() => second.result.current.startGame())
    expect(second.result.current.wasRestored).toBe(false)
  })

  it('goToMenu vuelve al inicio y descarta la partida guardada', () => {
    const { result } = renderHook(() => useGameLogic())
    act(() => result.current.startGame())
    expect(localStorage.getItem(SAVED_GAME_KEY)).not.toBeNull()
    act(() => result.current.goToMenu())
    expect(result.current.isActive).toBe(false)
    expect(localStorage.getItem(SAVED_GAME_KEY)).toBeNull()
  })

  it('con storage null no persiste nada', () => {
    const { result } = renderHook(() => useGameLogic({ storage: null }))
    act(() => result.current.startGame())
    act(() => result.current.submitAnswer(result.current.correctAnswer))
    expect(localStorage.length).toBe(0)
  })
})
