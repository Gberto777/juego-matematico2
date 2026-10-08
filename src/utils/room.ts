import { randomInt, type RandomFn } from './mathUtils'

export const ROOM_CODE_LENGTH = 6
/** Sin 0/O ni 1/I/L para que el código se pueda dictar y copiar de la pizarra sin errores. */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

export const PLAYER_NAME_MAX_LENGTH = 24
export const ROOM_NAME_MAX_LENGTH = 40

/** Un alumno se considera conectado si ha enviado datos en este intervalo. */
export const ACTIVE_WINDOW_MS = 2 * 60 * 1000

export type RoomStatus = 'open' | 'closed'

export interface Room {
  code: string
  name: string
  teacherId: string
  status: RoomStatus
  createdAt: Date | null
}

/** Estado del alumno dentro de la sala. */
export type PlayerStatus = 'waiting' | 'playing' | 'finished'

/** Métricas que cada alumno envía a `rooms/{code}/players/{uid}`. */
export interface Player {
  id: string
  name: string
  status: PlayerStatus
  /** Partida actual (o la última, si ya terminó). */
  score: number
  level: number
  lives: number
  totalCorrect: number
  totalAnswered: number
  /** Acumulados de todas las partidas terminadas en la sala. */
  gamesPlayed: number
  bestScore: number
  bestLevel: number
  correctAllGames: number
  answeredAllGames: number
  joinedAt: Date | null
  updatedAt: Date | null
}

export function generateRoomCode(random: RandomFn = Math.random): string {
  let code = ''
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_CODE_ALPHABET[randomInt(0, ROOM_CODE_ALPHABET.length - 1, random)]
  }
  return code
}

/** Pasa a mayúsculas y quita espacios/guiones, para aceptar "abc 123" o "ABC-123". */
export function normalizeRoomCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

export function isValidRoomCode(code: string): boolean {
  return code.length === ROOM_CODE_LENGTH && [...code].every((c) => ROOM_CODE_ALPHABET.includes(c))
}

/** Recorta y colapsa espacios. Devuelve null si el nombre queda vacío o es demasiado largo. */
export function normalizeName(input: string, maxLength: number): string | null {
  const name = input.trim().replace(/\s+/g, ' ')
  return name.length > 0 && name.length <= maxLength ? name : null
}

/** Porcentaje de aciertos redondeado, o null si no hay respuestas. */
export function accuracy(correct: number, answered: number): number | null {
  return answered > 0 ? Math.round((correct / answered) * 100) : null
}

/** Aciertos y respuestas totales, incluyendo la partida en curso si no ha terminado. */
export function playerTotals(player: Player): { correct: number; answered: number } {
  const inProgress = player.status === 'playing'
  return {
    correct: player.correctAllGames + (inProgress ? player.totalCorrect : 0),
    answered: player.answeredAllGames + (inProgress ? player.totalAnswered : 0),
  }
}

export function isPlayerActive(player: Player, now: number): boolean {
  return player.updatedAt !== null && now - player.updatedAt.getTime() <= ACTIVE_WINDOW_MS
}

/** Ranking: mejor puntuación (contando la partida en curso), luego nivel, luego nombre. */
export function rankPlayers(players: readonly Player[]): Player[] {
  const best = (p: Player) => Math.max(p.bestScore, p.score)
  return [...players].sort(
    (a, b) =>
      best(b) - best(a) ||
      Math.max(b.bestLevel, b.level) - Math.max(a.bestLevel, a.level) ||
      a.name.localeCompare(b.name, 'es'),
  )
}
