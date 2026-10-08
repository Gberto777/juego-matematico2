import { describe, expect, it } from 'vitest'
import {
  OPERAND_MAX,
  OPERAND_MIN,
  calculate,
  createEquation,
  createSeededRandom,
  generateAddition,
  generateEquation,
  generateMixed,
  generateMultiplication,
  generateSubtraction,
  isValidLevel,
  parseAnswer,
  randomInt,
  randomItem,
  type Equation,
} from './mathUtils'

const SAMPLES = 2000

function sample(generator: (random: () => number) => Equation, seed = 42): Equation[] {
  const { random } = createSeededRandom(seed)
  return Array.from({ length: SAMPLES }, () => generator(random))
}

function expectOperandsInRange(eq: Equation) {
  for (const n of [eq.left, eq.right]) {
    expect(Number.isInteger(n)).toBe(true)
    expect(n).toBeGreaterThanOrEqual(OPERAND_MIN)
    expect(n).toBeLessThanOrEqual(OPERAND_MAX)
  }
}

describe('randomInt', () => {
  it('respeta los límites inclusivos', () => {
    expect(randomInt(1, 10, () => 0)).toBe(1)
    expect(randomInt(1, 10, () => 0.9999999)).toBe(10)
  })

  it('cubre todo el rango', () => {
    const { random } = createSeededRandom(1)
    const seen = new Set(Array.from({ length: 500 }, () => randomInt(1, 10, random)))
    expect([...seen].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  })

  it('rechaza rangos inválidos', () => {
    expect(() => randomInt(5, 1)).toThrow(RangeError)
    expect(() => randomInt(1.5, 3)).toThrow(RangeError)
  })
})

describe('randomItem', () => {
  it('elige un elemento y falla con lista vacía', () => {
    expect(randomItem(['a', 'b', 'c'], () => 0.5)).toBe('b')
    expect(() => randomItem([])).toThrow(RangeError)
  })
})

describe('calculate / createEquation', () => {
  it('calcula cada operador', () => {
    expect(calculate(3, 4, '+')).toBe(7)
    expect(calculate(9, 4, '-')).toBe(5)
    expect(calculate(6, 7, '×')).toBe(42)
  })

  it('genera el texto de la ecuación', () => {
    expect(createEquation(8, 2, '-')).toEqual({ left: 8, right: 2, operator: '-', text: '8 - 2', answer: 6 })
  })
})

describe('generadores por tipo', () => {
  it('sumas con operandos de 1 a 10', () => {
    for (const eq of sample(generateAddition)) {
      expect(eq.operator).toBe('+')
      expectOperandsInRange(eq)
      expect(eq.answer).toBe(eq.left + eq.right)
    }
  })

  it('restas que nunca dan negativo', () => {
    for (const eq of sample(generateSubtraction)) {
      expect(eq.operator).toBe('-')
      expectOperandsInRange(eq)
      expect(eq.answer).toBeGreaterThanOrEqual(0)
      expect(eq.answer).toBe(eq.left - eq.right)
    }
  })

  it('multiplicaciones del 1 al 10', () => {
    for (const eq of sample(generateMultiplication)) {
      expect(eq.operator).toBe('×')
      expectOperandsInRange(eq)
      expect(eq.answer).toBe(eq.left * eq.right)
    }
  })

  it('mixtas incluyen los tres operadores y nunca negativos', () => {
    const eqs = sample(generateMixed)
    expect(new Set(eqs.map((e) => e.operator))).toEqual(new Set(['+', '-', '×']))
    for (const eq of eqs) {
      expect(eq.answer).toBeGreaterThanOrEqual(0)
    }
  })
})

describe('generateEquation', () => {
  it('usa el tipo de operación de cada nivel', () => {
    const { random } = createSeededRandom(7)
    expect(generateEquation(1, random).operator).toBe('+')
    expect(generateEquation(2, random).operator).toBe('-')
    expect(generateEquation(3, random).operator).toBe('×')
  })

  it('evita repetir la ecuación anterior', () => {
    const previous = createEquation(1, 1, '+')
    // Primero devuelve 0 (→ 1 + 1, repetida) y luego 0.5 (→ 6 + 6).
    const values = [0, 0, 0.5, 0.5]
    const random = () => values.shift() ?? 0.5
    expect(generateEquation(1, random, previous).text).toBe('6 + 6')
  })
})

describe('parseAnswer', () => {
  it.each([
    ['7', 7],
    [' 12 ', 12],
    ['-3', -3],
    ['0', 0],
    [5, 5],
  ])('acepta %j', (input, expected) => {
    expect(parseAnswer(input)).toBe(expected)
  })

  it.each(['', '   ', 'abc', '2.5', '1e3', '3 4', NaN, 2.5, Infinity])('rechaza %j', (input) => {
    expect(parseAnswer(input)).toBeNull()
  })
})

describe('isValidLevel', () => {
  it('solo acepta 1 a 4', () => {
    expect([0, 1, 2, 3, 4, 5, 2.5].map(isValidLevel)).toEqual([false, true, true, true, true, false, false])
  })
})

describe('createSeededRandom', () => {
  it('es determinista y devuelve valores en [0, 1)', () => {
    const a = createSeededRandom(123)
    const b = createSeededRandom(123)
    for (let i = 0; i < 100; i++) {
      const value = a.random()
      expect(value).toBe(b.random())
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
    expect(a.getSeed()).toBe(b.getSeed())
  })
})
