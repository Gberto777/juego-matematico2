import { describe, expect, it } from 'vitest'
import { codigoDeError, mensajeDeError } from './errores'

describe('errores de Supabase', () => {
  it('reconoce el código que lanza la base de datos', () => {
    const error = { message: 'SALA_LLENA', code: 'P0001', details: null, hint: null }
    expect(codigoDeError(error)).toBe('SALA_LLENA')
    expect(mensajeDeError(error)).toBe('La sala está llena.')
  })

  it('los errores de permiso tienen un mensaje propio', () => {
    expect(mensajeDeError({ message: 'permission denied for table salas', code: '42501' })).toBe(
      'No tienes permiso para hacer esto.',
    )
  })

  it('un fallo de red (fetch) se explica como falta de conexión', () => {
    expect(mensajeDeError(new TypeError('Failed to fetch'))).toBe('No hay conexión con el servidor.')
  })

  it('cualquier otro error usa el mensaje por defecto', () => {
    expect(mensajeDeError(new Error('xyz'), 'No se pudo guardar.')).toBe('No se pudo guardar.')
    expect(mensajeDeError(null)).toBe('Algo salió mal. Inténtalo de nuevo.')
    expect(codigoDeError({ message: 42 })).toBeNull()
  })
})
