/** Función que devuelve un número aleatorio en [0, 1), como Math.random. */
export type RandomFn = () => number

export type Operator = '+' | '-' | '×'

export type Level = 1 | 2 | 3 | 4

export const MIN_LEVEL: Level = 1
export const MAX_LEVEL: Level = 4

export interface Equation {
  left: number
  right: number
  operator: Operator
  /** Representación legible, p. ej. "7 - 3". */
  text: string
  answer: number
}

/** Rango de operandos usado en todos los niveles (inclusive). */
export const OPERAND_MIN = 1
export const OPERAND_MAX = 10

/** Entero aleatorio en [min, max], ambos inclusive. */
export function randomInt(min: number, max: number, random: RandomFn = Math.random): number {
  if (!Number.isInteger(min) || !Number.isInteger(max)) {
    throw new RangeError(`randomInt requiere enteros (min=${min}, max=${max})`)
  }
  if (min > max) {
    throw new RangeError(`randomInt: min (${min}) no puede ser mayor que max (${max})`)
  }
  return min + Math.floor(random() * (max - min + 1))
}

/** Elige un elemento aleatorio de una lista no vacía. */
export function randomItem<T>(items: readonly T[], random: RandomFn = Math.random): T {
  if (items.length === 0) {
    throw new RangeError('randomItem: la lista está vacía')
  }
  return items[randomInt(0, items.length - 1, random)]
}

export function calculate(left: number, right: number, operator: Operator): number {
  switch (operator) {
    case '+':
      return left + right
    case '-':
      return left - right
    case '×':
      return left * right
  }
}

export function createEquation(left: number, right: number, operator: Operator): Equation {
  return {
    left,
    right,
    operator,
    text: `${left} ${operator} ${right}`,
    answer: calculate(left, right, operator),
  }
}

export function generateAddition(random: RandomFn = Math.random): Equation {
  return createEquation(
    randomInt(OPERAND_MIN, OPERAND_MAX, random),
    randomInt(OPERAND_MIN, OPERAND_MAX, random),
    '+',
  )
}

/** Resta cuyo resultado nunca es negativo (el minuendo siempre es >= sustraendo). */
export function generateSubtraction(random: RandomFn = Math.random): Equation {
  const a = randomInt(OPERAND_MIN, OPERAND_MAX, random)
  const b = randomInt(OPERAND_MIN, OPERAND_MAX, random)
  return createEquation(Math.max(a, b), Math.min(a, b), '-')
}

export function generateMultiplication(random: RandomFn = Math.random): Equation {
  return createEquation(
    randomInt(OPERAND_MIN, OPERAND_MAX, random),
    randomInt(OPERAND_MIN, OPERAND_MAX, random),
    '×',
  )
}

const MIXED_GENERATORS = [generateAddition, generateSubtraction, generateMultiplication] as const

export function generateMixed(random: RandomFn = Math.random): Equation {
  return randomItem(MIXED_GENERATORS, random)(random)
}

export function isValidLevel(value: number): value is Level {
  return Number.isInteger(value) && value >= MIN_LEVEL && value <= MAX_LEVEL
}

/**
 * Genera una ecuación según el nivel:
 * 1 = sumas 1–10, 2 = restas sin negativos, 3 = multiplicaciones 1–10, 4 = mixtas.
 * Si se pasa `previous`, evita repetir exactamente la misma ecuación.
 */
export function generateEquation(
  level: Level,
  random: RandomFn = Math.random,
  previous?: Equation | null,
): Equation {
  const generator = {
    1: generateAddition,
    2: generateSubtraction,
    3: generateMultiplication,
    4: generateMixed,
  }[level]

  // Unos pocos reintentos bastan: la probabilidad de repetir es muy baja.
  let equation = generator(random)
  for (let i = 0; i < 10 && previous && equation.text === previous.text; i++) {
    equation = generator(random)
  }
  return equation
}

/**
 * Convierte la respuesta del usuario a número entero.
 * Devuelve null si está vacía o no es un entero válido (p. ej. "", "abc", "2.5").
 */
export function parseAnswer(input: string | number): number | null {
  if (typeof input === 'number') {
    return Number.isInteger(input) ? input : null
  }
  const trimmed = input.trim()
  if (!/^-?\d+$/.test(trimmed)) {
    return null
  }
  return Number(trimmed)
}

/**
 * Generador pseudoaleatorio determinista (mulberry32).
 * Permite reproducir partidas a partir de una semilla y testear sin mocks.
 */
export function createSeededRandom(seed: number): { random: RandomFn; getSeed: () => number } {
  let state = seed >>> 0
  return {
    random() {
      state = (state + 0x6d2b79f5) >>> 0
      let t = state
      t = Math.imul(t ^ (t >>> 15), t | 1)
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    },
    getSeed: () => state,
  }
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 32)
}
