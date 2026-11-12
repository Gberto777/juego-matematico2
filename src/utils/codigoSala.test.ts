import { describe, expect, it } from 'vitest'
import { esCodigoSalaValido, haceCuanto, nivelInicialDeTema, normalizarCodigoSala, validarDatosSala } from './codigoSala'

describe('validarDatosSala', () => {
  const base = { nombre: '4.º B', tema: 'mixta' as const, dificultad: 'media' as const, max_jugadores: 30 }
  it('acepta datos válidos', () => expect(validarDatosSala(base)).toBeNull())
  it('exige nombre', () => expect(validarDatosSala({ ...base, nombre: '  ' })).toMatch(/nombre/))
  it.each([0, 101, 2.5, Number.NaN])('rechaza el límite %s', (max) =>
    expect(validarDatosSala({ ...base, max_jugadores: max })).toMatch(/entre 1 y 100/),
  )
})

describe('haceCuanto', () => {
  const ahora = Date.parse('2026-11-09T12:00:00Z')
  it.each([
    ['2026-11-09T11:59:30Z', 'ahora mismo'],
    ['2026-11-09T11:55:00Z', 'hace 5 min'],
    ['2026-11-09T09:00:00Z', 'hace 3 h'],
    ['2026-11-08T12:00:00Z', 'hace 1 día'],
    ['2026-11-01T12:00:00Z', 'hace 8 días'],
  ])('%s → %s', (fecha, texto) => expect(haceCuanto(fecha, ahora)).toBe(texto))
})

describe('códigos de sala', () => {
  it.each([
    ['mul4821', 'MUL-4821'],
    ['MUL-4821', 'MUL-4821'],
    [' mix 1234 ', 'MIX-1234'],
    ['sum-12345', 'SUM-1234'],
    ['mu', 'MU'],
    ['', ''],
  ])('normaliza %j → %j', (entrada, codigo) => {
    expect(normalizarCodigoSala(entrada)).toBe(codigo)
  })

  it('valida el formato TEM-1234', () => {
    expect(esCodigoSalaValido('MUL-4821')).toBe(true)
    expect(esCodigoSalaValido('MUL4821')).toBe(false)
    expect(esCodigoSalaValido('MU-4821')).toBe(false)
    expect(esCodigoSalaValido('ABC234')).toBe(false)
  })

  it('el tema decide el nivel inicial del juego web', () => {
    expect(nivelInicialDeTema('suma')).toBe(1)
    expect(nivelInicialDeTema('resta')).toBe(2)
    expect(nivelInicialDeTema('multiplicacion')).toBe(3)
    expect(nivelInicialDeTema('mixta')).toBe(1)
  })
})
