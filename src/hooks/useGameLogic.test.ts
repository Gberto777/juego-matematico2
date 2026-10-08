// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { INITIAL_LIVES } from '../utils/gameLogic'
import { createMemoryRepository, type GameRepository } from '../utils/storage'
import { useGameLogic } from './useGameLogic'

/** Monta el hook con un repositorio y espera a que termine la carga inicial. */
async function renderWithRepository(repository: GameRepository) {
  const hook = renderHook(() => useGameLogic({ repository }))
  await waitFor(() => expect(hook.result.current.isLoading).toBe(false))
  return hook
}

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
      isLoading: false,
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
  it('guarda los récords y los recupera', async () => {
    const repo = createMemoryRepository()
    const first = await renderWithRepository(repo)
    act(() => first.result.current.startGame())
    act(() => first.result.current.submitAnswer(first.result.current.correctAnswer))
    act(() => first.result.current.submitAnswer(first.result.current.correctAnswer))
    await waitFor(() => expect(repo.data.records).toEqual({ highScore: 20, maxLevel: 1 }))
    first.unmount()

    const second = await renderWithRepository(repo)
    expect(second.result.current.records).toEqual({ highScore: 20, maxLevel: 1 })
  })

  it('está cargando hasta que responde el repositorio', async () => {
    const repo = createMemoryRepository({ records: { highScore: 50, maxLevel: 2 } })
    const { result } = renderHook(() => useGameLogic({ repository: repo }))
    expect(result.current.isLoading).toBe(true)
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.records).toEqual({ highScore: 50, maxLevel: 2 })
  })

  it('si falla la carga, se juega con récords vacíos', async () => {
    const repo: GameRepository = { ...createMemoryRepository(), load: () => Promise.reject(new Error('sin red')) }
    const { result } = await renderWithRepository(repo)
    expect(result.current).toMatchObject({ isActive: false, records: { highScore: 0, maxLevel: 0 } })
  })

  it('recupera la partida en curso tras recargar', async () => {
    const repo = createMemoryRepository()
    const first = await renderWithRepository(repo)
    act(() => first.result.current.startGame())
    act(() => first.result.current.submitAnswer(first.result.current.correctAnswer))
    act(() => first.result.current.submitAnswer(-1))
    const before = first.result.current
    await waitFor(() => expect(repo.data.savedGame).toMatchObject({ totalAnswered: 2 }))
    first.unmount()

    const second = await renderWithRepository(repo)
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

  it('no guarda partida si no se ha empezado', async () => {
    const repo = createMemoryRepository()
    await renderWithRepository(repo)
    expect(repo.data.savedGame).toBeNull()
  })

  it('borra la partida guardada al terminar, pero conserva los récords', async () => {
    const repo = createMemoryRepository()
    const first = await renderWithRepository(repo)
    act(() => first.result.current.startGame())
    act(() => first.result.current.submitAnswer(first.result.current.correctAnswer))
    await waitFor(() => expect(repo.data.savedGame).not.toBeNull())
    for (let i = 0; i < INITIAL_LIVES; i++) {
      act(() => first.result.current.submitAnswer(-1))
    }
    expect(first.result.current.isNewHighScore).toBe(true)
    await waitFor(() => expect(repo.data.savedGame).toBeNull())
    first.unmount()

    const second = await renderWithRepository(repo)
    expect(second.result.current).toMatchObject({ isActive: false, records: { highScore: 10, maxLevel: 1 } })
  })

  it('una nueva partida ya no se marca como recuperada', async () => {
    const repo = createMemoryRepository()
    const first = await renderWithRepository(repo)
    act(() => first.result.current.startGame())
    await waitFor(() => expect(repo.data.savedGame).not.toBeNull())
    first.unmount()

    const second = await renderWithRepository(repo)
    expect(second.result.current.wasRestored).toBe(true)
    act(() => second.result.current.startGame())
    expect(second.result.current.wasRestored).toBe(false)
  })

  it('goToMenu vuelve al inicio y descarta la partida guardada', async () => {
    const repo = createMemoryRepository()
    const { result } = await renderWithRepository(repo)
    act(() => result.current.startGame())
    await waitFor(() => expect(repo.data.savedGame).not.toBeNull())
    act(() => result.current.goToMenu())
    expect(result.current.isActive).toBe(false)
    await waitFor(() => expect(repo.data.savedGame).toBeNull())
  })

  it('no reescribe lo que acaba de cargar', async () => {
    const repo = createMemoryRepository({ records: { highScore: 30, maxLevel: 1 } })
    let writes = 0
    const counting: GameRepository = {
      ...repo,
      saveRecords: async (r) => {
        writes++
        await repo.saveRecords(r)
      },
      clearSavedGame: async () => {
        writes++
        await repo.clearSavedGame()
      },
    }
    await renderWithRepository(counting)
    expect(writes).toBe(0)
  })
})
