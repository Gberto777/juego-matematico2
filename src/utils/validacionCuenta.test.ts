import { describe, expect, it } from 'vitest'
import {
  errorConfirmacion,
  errorEmail,
  errorNombre,
  errorPassword,
  normalizarEmail,
  normalizarNombre,
  primerError,
} from './validacionCuenta'

describe('validación de cuenta', () => {
  it('normaliza correo y nombre', () => {
    expect(normalizarEmail('  Ana@Colegio.EDU ')).toBe('ana@colegio.edu')
    expect(normalizarNombre('  Ana   María  ')).toBe('Ana María')
  })

  it.each([
    ['', 'Escribe tu correo.'],
    ['ana', 'El correo no parece válido (ejemplo: ana@colegio.edu).'],
    ['ana@colegio', 'El correo no parece válido (ejemplo: ana@colegio.edu).'],
    [' ana@colegio.edu ', null],
  ])('correo %j', (email, error) => {
    expect(errorEmail(email)).toBe(error)
  })

  it('contraseña: entre 8 y 72 caracteres', () => {
    expect(errorPassword('1234567')).toMatch(/al menos 8/)
    expect(errorPassword('12345678')).toBeNull()
    expect(errorPassword('x'.repeat(73))).toMatch(/máximo 72/)
  })

  it('nombre: obligatorio y hasta 40 caracteres', () => {
    expect(errorNombre('   ')).toBe('Escribe tu nombre.')
    expect(errorNombre('n'.repeat(41))).toMatch(/máximo 40/)
    expect(errorNombre('Ana')).toBeNull()
  })

  it('la confirmación debe coincidir', () => {
    expect(errorConfirmacion('secreta123', 'secreta124')).toBe('Las contraseñas no coinciden.')
    expect(errorConfirmacion('secreta123', 'secreta123')).toBeNull()
  })

  it('primerError devuelve el primero que falla', () => {
    expect(primerError(null, 'a', 'b')).toBe('a')
    expect(primerError(null, null)).toBeNull()
  })
})
