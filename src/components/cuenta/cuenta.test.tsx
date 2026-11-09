// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../../App'
import type { ServicioAuth } from '../../supabase/servicioAuth'
import type { ServicioUsuarios } from '../../supabase/servicioUsuarios'
import type { Rol, Usuario } from '../../supabase/tipos'

const PASSWORD = 'secreta123'

function perfil(rol: Rol, datos: Partial<Usuario> = {}): Usuario {
  return {
    id: `id-${rol}`,
    email: `${rol}@prueba.test`,
    nombre: `Nombre ${rol}`,
    rol,
    avatar: 'zorro',
    activo: true,
    creado_en: '2026-11-09T10:00:00Z',
    actualizado_en: '2026-11-09T10:00:00Z',
    ...datos,
  }
}

/** Imita a Supabase Auth: avisa de la sesión de forma asíncrona, como onAuthStateChange. */
class ServicioFalso implements ServicioAuth {
  perfiles = new Map<string, Usuario>()
  private oyente: ((uid: string | null, recuperacion: boolean) => void) | null = null
  private uid: string | null

  constructor(perfiles: Usuario[] = [], sesionInicial: Usuario | null = null) {
    for (const p of perfiles) this.perfiles.set(p.id, p)
    this.uid = sesionInicial?.id ?? null
  }

  emitir(uid: string | null, recuperacion = false) {
    this.uid = uid
    act(() => this.oyente?.(uid, recuperacion))
  }

  iniciarSesion = vi.fn(async (email: string, password: string) => {
    const usuario = [...this.perfiles.values()].find((p) => p.email === email)
    if (!usuario || password !== PASSWORD) {
      throw { name: 'AuthApiError', code: 'invalid_credentials', message: 'Invalid login credentials' }
    }
    setTimeout(() => this.emitir(usuario.id), 0)
  })

  registrarse = vi.fn(async () => ({ necesitaConfirmar: true }))
  enviarRecuperacion = vi.fn(async () => {})
  cambiarPassword = vi.fn(async () => {})
  cerrarSesion = vi.fn(async () => {
    setTimeout(() => this.emitir(null), 0)
  })
  cargarPerfil = vi.fn(async (uid: string) => this.perfiles.get(uid) ?? null)

  escuchar(alCambiar: (uid: string | null, recuperacion: boolean) => void) {
    this.oyente = alCambiar
    const inicial = this.uid
    queueMicrotask(() => act(() => alCambiar(inicial, false)))
    return () => {
      this.oyente = null
    }
  }
}

const servicioUsuariosVacio: ServicioUsuarios = {
  listar: async () => [],
  crear: async () => {
    throw new Error('no se usa')
  },
  actualizar: async () => {
    throw new Error('no se usa')
  },
  enviarRecuperacion: async () => {},
}

function abrir(hash: string, servicio: ServicioAuth | null) {
  window.location.hash = hash
  return render(<App servicioAuth={servicio} servicioUsuarios={servicio ? servicioUsuariosVacio : null} />)
}

function escribir(etiqueta: RegExp, valor: string) {
  fireEvent.change(screen.getByLabelText(etiqueta), { target: { value: valor } })
}

function enviar(boton: RegExp) {
  fireEvent.click(screen.getByRole('button', { name: boton }))
}

afterEach(() => {
  cleanup()
  window.location.hash = ''
})

describe('rutas protegidas por rol', () => {
  it('sin sesión, el panel de admin pide entrar y, al entrar, se muestra', async () => {
    const servicio = new ServicioFalso([perfil('admin')])
    abrir('#/admin', servicio)

    expect(await screen.findByText('Inicia sesión para ver esta página.')).toBeTruthy()
    escribir(/correo/i, '  Admin@Prueba.TEST ')
    escribir(/contraseña/i, PASSWORD)
    enviar(/entrar/i)

    expect(await screen.findByRole('heading', { name: 'Usuarios' })).toBeTruthy()
    expect(servicio.iniciarSesion).toHaveBeenCalledWith('admin@prueba.test', PASSWORD)
  })

  it.each<[string, Rol, string]>([
    ['#/admin', 'alumno', 'No tienes permiso'],
    ['#/admin', 'docente', 'No tienes permiso'],
    ['#/docente', 'alumno', 'No tienes permiso'],
    ['#/docente', 'docente', 'Panel docente'],
    ['#/docente', 'admin', 'Panel docente'],
  ])('%s con rol %s → %s', async (hash, rol, titulo) => {
    const usuario = perfil(rol)
    abrir(hash, new ServicioFalso([usuario], usuario))
    expect(await screen.findByRole('heading', { name: titulo })).toBeTruthy()
  })

  it('una cuenta desactivada no entra ni a su cuenta, y puede cerrar sesión', async () => {
    const usuario = perfil('admin', { activo: false })
    const servicio = new ServicioFalso([usuario], usuario)
    abrir('#/cuenta', servicio)
    expect(await screen.findByRole('heading', { name: 'Cuenta desactivada' })).toBeTruthy()
    enviar(/cerrar sesión/i)
    expect(servicio.cerrarSesion).toHaveBeenCalled()
  })

  it('si falla la carga del perfil, se puede reintentar', async () => {
    const usuario = perfil('alumno')
    const servicio = new ServicioFalso([usuario], usuario)
    servicio.cargarPerfil.mockRejectedValueOnce(new Error('sin red'))
    abrir('#/cuenta', servicio)

    expect(await screen.findByRole('heading', { name: 'No se pudo cargar tu cuenta' })).toBeTruthy()
    enviar(/reintentar/i)
    expect(await screen.findByRole('heading', { name: usuario.nombre })).toBeTruthy()
  })

  it('sin Supabase configurado, las cuentas no están disponibles', () => {
    abrir('#/entrar', null)
    expect(screen.getByRole('heading', { name: 'Cuentas no disponibles' })).toBeTruthy()
  })
})

describe('entrar', () => {
  it('valida antes de enviar', async () => {
    const servicio = new ServicioFalso()
    abrir('#/entrar', servicio)
    await screen.findByRole('heading', { name: 'Entrar' })
    enviar(/entrar/i)
    expect(screen.getByRole('alert').textContent).toMatch('Escribe tu correo.')
    expect(servicio.iniciarSesion).not.toHaveBeenCalled()
  })

  it('traduce el error de credenciales incorrectas', async () => {
    abrir('#/entrar', new ServicioFalso([perfil('alumno')]))
    await screen.findByRole('heading', { name: 'Entrar' })
    escribir(/correo/i, 'alumno@prueba.test')
    escribir(/contraseña/i, 'otra-clave')
    enviar(/entrar/i)
    expect(await screen.findByText(/correo o contraseña incorrectos/i)).toBeTruthy()
  })

  it('con la sesión ya iniciada, "Entrar" lleva a "Mi cuenta"', async () => {
    const usuario = perfil('docente')
    abrir('#/entrar', new ServicioFalso([usuario], usuario))
    await waitFor(() => expect(window.location.hash).toBe('#/cuenta'))
    expect(await screen.findByRole('heading', { name: usuario.nombre })).toBeTruthy()
  })
})

describe('registro', () => {
  it('avisa si las contraseñas no coinciden', async () => {
    const servicio = new ServicioFalso()
    abrir('#/registro', servicio)
    await screen.findByRole('heading', { name: 'Crear cuenta' })
    escribir(/tu nombre/i, 'Ana')
    escribir(/^correo/i, 'ana@prueba.test')
    escribir(/contraseña \(mínimo 8\)/i, PASSWORD)
    escribir(/repite/i, 'otra-cosa')
    enviar(/crear cuenta/i)
    expect(screen.getByRole('alert').textContent).toMatch('Las contraseñas no coinciden.')
    expect(servicio.registrarse).not.toHaveBeenCalled()
  })

  it('crea la cuenta con los datos limpios y pide revisar el correo', async () => {
    const servicio = new ServicioFalso()
    abrir('#/registro', servicio)
    await screen.findByRole('heading', { name: 'Crear cuenta' })
    escribir(/tu nombre/i, '  Ana   García ')
    escribir(/^correo/i, 'Ana@Prueba.test')
    escribir(/contraseña \(mínimo 8\)/i, PASSWORD)
    escribir(/repite/i, PASSWORD)
    enviar(/crear cuenta/i)

    expect(await screen.findByRole('heading', { name: 'Revisa tu correo' })).toBeTruthy()
    expect(servicio.registrarse).toHaveBeenCalledWith('ana@prueba.test', PASSWORD, 'Ana García')
  })
})

describe('recuperar la contraseña', () => {
  it('envía el enlace y muestra el mismo mensaje exista o no la cuenta', async () => {
    const servicio = new ServicioFalso()
    abrir('#/recuperar', servicio)
    await screen.findByRole('heading', { name: 'Recuperar contraseña' })
    escribir(/correo/i, 'quien@prueba.test')
    enviar(/enviar enlace/i)
    expect(await screen.findByRole('heading', { name: 'Revisa tu correo' })).toBeTruthy()
    expect(servicio.enviarRecuperacion).toHaveBeenCalledWith('quien@prueba.test')
  })

  it('al abrir el enlace del correo se va a "Nueva contraseña"', async () => {
    const usuario = perfil('alumno')
    const servicio = new ServicioFalso([usuario])
    abrir('#/', servicio)
    await screen.findByRole('link', { name: /entrar/i })
    servicio.emitir(usuario.id, true)
    await waitFor(() => expect(window.location.hash).toBe('#/restablecer'))
  })

  it('cambia la contraseña', async () => {
    const usuario = perfil('alumno')
    const servicio = new ServicioFalso([usuario], usuario)
    abrir('#/restablecer', servicio)
    await screen.findByRole('heading', { name: 'Nueva contraseña' })
    escribir(/contraseña nueva/i, 'nuevaClave1')
    escribir(/repite/i, 'nuevaClave1')
    enviar(/guardar contraseña/i)
    expect(await screen.findByRole('heading', { name: 'Contraseña cambiada' })).toBeTruthy()
    expect(servicio.cambiarPassword).toHaveBeenCalledWith('nuevaClave1')
  })

  it('sin sesión, el enlace se considera caducado', async () => {
    abrir('#/restablecer', new ServicioFalso())
    expect(await screen.findByRole('heading', { name: 'El enlace no es válido' })).toBeTruthy()
  })
})

describe('mi cuenta', () => {
  it('muestra los datos y las opciones según el rol', async () => {
    const usuario = perfil('docente', { nombre: 'Profe Luis' })
    abrir('#/cuenta', new ServicioFalso([usuario], usuario))
    expect(await screen.findByRole('heading', { name: 'Profe Luis' })).toBeTruthy()
    expect(screen.getByText('Docente')).toBeTruthy()
    expect(screen.getByRole('link', { name: /panel docente/i })).toBeTruthy()
    expect(screen.queryByRole('link', { name: /administración/i })).toBeNull()
  })

  it('al cerrar sesión vuelve a pedir entrar', async () => {
    const usuario = perfil('alumno')
    const servicio = new ServicioFalso([usuario], usuario)
    abrir('#/cuenta', servicio)
    await screen.findByRole('heading', { name: usuario.nombre })
    enviar(/cerrar sesión/i)
    expect(await screen.findByText('Inicia sesión para ver esta página.')).toBeTruthy()
  })
})

describe('botón de cuenta en la esquina', () => {
  it('sin sesión invita a entrar; con sesión muestra el nombre', async () => {
    const usuario = perfil('alumno', { nombre: 'Lucía' })
    const servicio = new ServicioFalso([usuario])
    abrir('#/', servicio)
    expect((await screen.findByRole('link', { name: /entrar/i })).getAttribute('href')).toBe('#/entrar')

    servicio.emitir(usuario.id)
    expect(await screen.findByRole('link', { name: 'Mi cuenta (Lucía)' })).toBeTruthy()
  })

  it('sin Supabase no aparece', () => {
    abrir('#/', null)
    expect(screen.queryByRole('link', { name: /entrar/i })).toBeNull()
  })
})
