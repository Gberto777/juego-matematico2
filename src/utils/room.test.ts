import { describe, expect, it } from 'vitest'
import { createSeededRandom } from './mathUtils'
import {
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  accuracy,
  generateRoomCode,
  isPlayerActive,
  isValidRoomCode,
  normalizeName,
  normalizeRoomCode,
  playerTotals,
  rankPlayers,
  type Player,
} from './room'

function player(overrides: Partial<Player>): Player {
  return {
    id: 'p',
    name: 'Ana',
    status: 'waiting',
    score: 0,
    level: 1,
    lives: 3,
    totalCorrect: 0,
    totalAnswered: 0,
    gamesPlayed: 0,
    bestScore: 0,
    bestLevel: 0,
    correctAllGames: 0,
    answeredAllGames: 0,
    joinedAt: null,
    updatedAt: null,
    ...overrides,
  }
}

describe('códigos de sala', () => {
  it('genera códigos válidos y sin caracteres ambiguos', () => {
    const rng = createSeededRandom(7)
    for (let i = 0; i < 200; i++) {
      const code = generateRoomCode(rng.random)
      expect(code).toHaveLength(ROOM_CODE_LENGTH)
      expect(isValidRoomCode(code)).toBe(true)
    }
    expect(ROOM_CODE_ALPHABET).not.toMatch(/[01OIL]/)
  })

  it('normaliza lo que escribe el alumno', () => {
    expect(normalizeRoomCode(' abc-234 ')).toBe('ABC234')
  })

  it.each(['', 'ABC23', 'ABC2345', 'ABCDE0', 'abcdef'])('rechaza %j', (code) => {
    expect(isValidRoomCode(code)).toBe(false)
  })
})

describe('normalizeName', () => {
  it('recorta y colapsa espacios', () => {
    expect(normalizeName('  Ana   García ', 24)).toBe('Ana García')
  })

  it('rechaza vacíos y demasiado largos', () => {
    expect(normalizeName('   ', 24)).toBeNull()
    expect(normalizeName('x'.repeat(25), 24)).toBeNull()
  })
})

describe('métricas', () => {
  it('accuracy', () => {
    expect(accuracy(0, 0)).toBeNull()
    expect(accuracy(2, 3)).toBe(67)
  })

  it('playerTotals solo suma la partida actual si está en curso', () => {
    const base = { correctAllGames: 10, answeredAllGames: 12, totalCorrect: 3, totalAnswered: 4 }
    expect(playerTotals(player({ ...base, status: 'playing' }))).toEqual({ correct: 13, answered: 16 })
    // Al terminar, la partida ya se sumó a los acumulados.
    expect(playerTotals(player({ ...base, status: 'finished' }))).toEqual({ correct: 10, answered: 12 })
  })

  it('isPlayerActive según la última actualización', () => {
    const now = Date.parse('2026-01-01T10:00:00Z')
    expect(isPlayerActive(player({ updatedAt: new Date(now - 30_000) }), now)).toBe(true)
    expect(isPlayerActive(player({ updatedAt: new Date(now - 10 * 60_000) }), now)).toBe(false)
    expect(isPlayerActive(player({ updatedAt: null }), now)).toBe(false)
  })

  it('rankPlayers ordena por mejor puntuación (incluida la partida en curso), nivel y nombre', () => {
    const ranked = rankPlayers([
      player({ id: 'a', name: 'Bea', bestScore: 50 }),
      player({ id: 'b', name: 'Ana', bestScore: 50 }),
      player({ id: 'c', name: 'Carlos', bestScore: 20, score: 80, status: 'playing' }),
      player({ id: 'd', name: 'Dani', bestScore: 50, bestLevel: 3 }),
    ])
    expect(ranked.map((p) => p.id)).toEqual(['c', 'd', 'b', 'a'])
  })
})
