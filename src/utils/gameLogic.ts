import {
  MAX_LEVEL,
  MIN_LEVEL,
  createSeededRandom,
  generateEquation,
  isValidLevel,
  parseAnswer,
  type Equation,
  type Level,
} from './mathUtils'

export const INITIAL_LIVES = 3
/** Aciertos necesarios dentro de un nivel para pasar al siguiente. */
export const CORRECT_ANSWERS_TO_LEVEL_UP = 5
/** Puntos por acierto; se multiplican por el nivel actual. */
export const POINTS_PER_CORRECT_ANSWER = 10

export type GameStatus = 'playing' | 'game-over'

/** Récords históricos que se conservan entre partidas. */
export interface GameRecords {
  highScore: number
  /** 0 si todavía no se ha jugado ninguna partida. */
  maxLevel: number
}

export const EMPTY_RECORDS: GameRecords = { highScore: 0, maxLevel: 0 }

export type AnswerResult =
  | { kind: 'correct'; expected: number; given: number; pointsEarned: number; leveledUp: boolean }
  | { kind: 'incorrect'; expected: number; given: number }
  | { kind: 'invalid' }

export interface GameState {
  equation: Equation
  level: Level
  score: number
  lives: number
  status: GameStatus
  correctInLevel: number
  totalCorrect: number
  totalAnswered: number
  lastResult: AnswerResult | null
  /** Semilla del generador aleatorio; mantiene el reducer puro y reproducible. */
  seed: number
  records: GameRecords
  /** Récord que había al empezar la partida, para saber si se ha superado. */
  previousHighScore: number
}

export type GameAction =
  | { type: 'submit-answer'; answer: string | number }
  | { type: 'reset'; seed: number; level?: Level }

export function createInitialState(
  seed: number,
  level: Level = MIN_LEVEL,
  records: GameRecords = EMPTY_RECORDS,
): GameState {
  if (!isValidLevel(level)) {
    throw new RangeError(`Nivel inválido: ${level}`)
  }
  const rng = createSeededRandom(seed)
  const equation = generateEquation(level, rng.random)
  return {
    equation,
    level,
    score: 0,
    lives: INITIAL_LIVES,
    status: 'playing',
    correctInLevel: 0,
    totalCorrect: 0,
    totalAnswered: 0,
    lastResult: null,
    seed: rng.getSeed(),
    records,
    previousHighScore: records.highScore,
  }
}

/** Combina los récords con el resultado actual; devuelve el mismo objeto si no cambian. */
export function updateRecords(records: GameRecords, score: number, level: number): GameRecords {
  if (score <= records.highScore && level <= records.maxLevel) {
    return records
  }
  return {
    highScore: Math.max(records.highScore, score),
    maxLevel: Math.max(records.maxLevel, level),
  }
}

export function isNewHighScore(state: GameState): boolean {
  return state.score > state.previousHighScore
}

export function pointsFor(level: Level): number {
  return POINTS_PER_CORRECT_ANSWER * level
}

export function submitAnswer(state: GameState, input: string | number): GameState {
  if (state.status === 'game-over') {
    return state
  }

  const given = parseAnswer(input)
  if (given === null) {
    // Una entrada vacía o no numérica no penaliza: solo se informa.
    return { ...state, lastResult: { kind: 'invalid' } }
  }

  const expected = state.equation.answer
  const rng = createSeededRandom(state.seed)
  const totalAnswered = state.totalAnswered + 1

  if (given === expected) {
    const pointsEarned = pointsFor(state.level)
    const reachedThreshold = state.correctInLevel + 1 >= CORRECT_ANSWERS_TO_LEVEL_UP
    const leveledUp = reachedThreshold && state.level < MAX_LEVEL
    const level = leveledUp ? ((state.level + 1) as Level) : state.level
    const score = state.score + pointsEarned

    return {
      ...state,
      level,
      score,
      records: updateRecords(state.records, score, level),
      correctInLevel: leveledUp ? 0 : state.correctInLevel + 1,
      totalCorrect: state.totalCorrect + 1,
      totalAnswered,
      equation: generateEquation(level, rng.random, state.equation),
      lastResult: { kind: 'correct', expected, given, pointsEarned, leveledUp },
      seed: rng.getSeed(),
    }
  }

  const lives = Math.max(0, state.lives - 1)
  const status: GameStatus = lives === 0 ? 'game-over' : 'playing'

  return {
    ...state,
    lives,
    status,
    totalAnswered,
    records: updateRecords(state.records, state.score, state.level),
    // Al perder la partida se conserva la última ecuación para poder mostrarla.
    equation:
      status === 'playing' ? generateEquation(state.level, rng.random, state.equation) : state.equation,
    lastResult: { kind: 'incorrect', expected, given },
    seed: status === 'playing' ? rng.getSeed() : state.seed,
  }
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'submit-answer':
      return submitAnswer(state, action.answer)
    case 'reset':
      // Los récords se conservan al empezar una nueva partida.
      return createInitialState(action.seed, action.level, state.records)
  }
}
