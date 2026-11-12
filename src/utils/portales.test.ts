import { describe, expect, it } from 'vitest'
import { createEquation, createSeededRandom, type Level } from './mathUtils'
import { crearPortal, distractores, nivelPorAciertos } from './portales'

describe('portales de la portada', () => {
  it('siempre hay tres respuestas distintas, una correcta y ninguna negativa', () => {
    const rng = createSeededRandom(42)
    for (const nivel of [1, 2, 3, 4] as Level[]) {
      for (let i = 0; i < 200; i++) {
        const { ecuacion, opciones } = crearPortal(nivel, rng.random)
        expect(new Set(opciones).size).toBe(3)
        expect(opciones).toContain(ecuacion.answer)
        expect(opciones.every((o) => o >= 0)).toBe(true)
      }
    }
  })

  it('en multiplicar, los distractores son errores típicos de la tabla', () => {
    const ecuacion = createEquation(7, 8, '×')
    const posibles = [56 + 7, 56 - 7, 56 + 8, 56 - 8, 7 + 8]
    for (let i = 0; i < 20; i++) {
      for (const d of distractores(ecuacion)) expect(posibles).toContain(d)
    }
  })

  it('resuelve los casos sin bastantes candidatos (1 × 1)', () => {
    const [x, y] = distractores(createEquation(1, 1, '×'))
    expect(x).not.toBe(y)
    expect([x, y]).not.toContain(1)
    expect(Math.min(x, y)).toBeGreaterThanOrEqual(1)
  })

  it('cada dos aciertos se pasa a la región siguiente, hasta el castillo', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8, 20].map(nivelPorAciertos)).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 4, 4])
  })

  it('la operación corresponde a la región', () => {
    expect(crearPortal(1).ecuacion.operator).toBe('+')
    expect(crearPortal(2).ecuacion.operator).toBe('-')
    expect(crearPortal(3).ecuacion.operator).toBe('×')
  })
})
