import { describe, expect, it } from 'vitest'
import { hojasDeProgreso, nombreArchivo, textoOperacion } from './excel'

describe('exportar a Excel', () => {
  const hojas = hojasDeProgreso(
    [
      {
        usuario_id: 'a',
        nombre: 'Ana',
        avatar: 'zorro',
        partidas: 2,
        aciertos: 9,
        respuestas: 10,
        porcentaje_aciertos: 90,
        mejor_puntos: 60,
        nivel_max: 3,
        ultima_partida: '2026-11-09T10:00:00Z',
      },
      { usuario_id: 'b', nombre: 'Beto', avatar: 'rana', partidas: 0, aciertos: 0, respuestas: 0, porcentaje_aciertos: null, mejor_puntos: 0, nivel_max: 0, ultima_partida: null },
    ],
    [{ operacion: 'multiplicacion', respuestas: 4, fallos: 3, porcentaje_fallo: 75 }],
    [{ operacion: 'multiplicacion', a: 7, b: 8, resultado: 56, intentos: 4, fallos: 3 }],
  )

  it('genera tres hojas con cabecera en negrita', () => {
    expect(hojas.map((h) => h.sheet)).toEqual(['Alumnos', 'Por operación', 'Más falladas'])
    for (const h of hojas) {
      expect(h.data[0].every((c) => typeof c === 'object' && c !== null && 'fontWeight' in c)).toBe(true)
      expect(h.columns).toHaveLength(h.data[0].length)
    }
  })

  it('una fila por alumno, con la fecha como fecha y las celdas vacías como null', () => {
    const [, ana, beto] = hojas[0].data
    expect(ana.slice(0, 7)).toEqual(['Ana', 2, 9, 10, 90, 60, 3])
    expect(ana[7]).toBeInstanceOf(Date)
    expect(beto[4]).toBeNull()
    expect(beto[7]).toBeNull()
  })

  it('las operaciones aparecen con su nombre y las cuentas escritas', () => {
    expect(hojas[1].data[1]).toEqual(['Multiplicaciones', 4, 3, 75])
    expect(hojas[2].data[1]).toEqual(['7 × 8 = 56', 4, 3, 75])
    expect(textoOperacion({ operacion: 'resta', a: 9, b: 4, resultado: 5 })).toBe('9 − 4 = 5')
  })

  it('el archivo lleva el código de la sala y la fecha', () => {
    expect(nombreArchivo({ codigo: 'MUL-4821' }, new Date(2026, 10, 9))).toBe('MathQuest-MUL-4821-2026-11-09.xlsx')
  })
})
