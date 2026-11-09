import { describe, expect, it } from 'vitest'
import { validarNuevoUsuario } from '../../supabase/functions/admin-crear-usuario/validar.ts'

const valido = { email: 'Ana@Colegio.edu', password: 'secreta123', nombre: '  Ana   López ', rol: 'docente' }

describe('validarNuevoUsuario (función Edge admin-crear-usuario)', () => {
  it('acepta datos válidos y los normaliza', () => {
    expect(validarNuevoUsuario(valido)).toEqual({
      ok: true,
      datos: { email: 'ana@colegio.edu', password: 'secreta123', nombre: 'Ana López', rol: 'docente' },
    })
  })

  it('si no se indica rol, crea un alumno', () => {
    const { rol: _rol, ...sinRol } = valido
    const resultado = validarNuevoUsuario(sinRol)
    expect(resultado.ok && resultado.datos.rol).toBe('alumno')
  })

  it.each([
    [null, 'CUERPO_INVALIDO'],
    ['texto', 'CUERPO_INVALIDO'],
    [{ ...valido, email: 'sin-arroba' }, 'EMAIL_INVALIDO'],
    [{ ...valido, email: 42 }, 'EMAIL_INVALIDO'],
    [{ ...valido, password: 'corta' }, 'PASSWORD_INVALIDA'],
    [{ ...valido, password: 'x'.repeat(73) }, 'PASSWORD_INVALIDA'],
    [{ ...valido, nombre: '   ' }, 'NOMBRE_INVALIDO'],
    [{ ...valido, nombre: 'n'.repeat(41) }, 'NOMBRE_INVALIDO'],
    [{ ...valido, rol: 'superadmin' }, 'ROL_INVALIDO'],
  ])('rechaza %j con %s', (cuerpo, error) => {
    expect(validarNuevoUsuario(cuerpo)).toEqual({ ok: false, error })
  })
})
