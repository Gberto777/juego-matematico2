// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../../auth/AuthProvider'
import type { CambiosUsuario, NuevoUsuario, ServicioUsuarios } from '../../supabase/servicioUsuarios'
import type { Usuario } from '../../supabase/tipos'
import PanelAdmin from './PanelAdmin'

function usuario(id: string, nombre: string, rol: Usuario['rol'], activo = true): Usuario {
  return {
    id,
    nombre,
    rol,
    activo,
    email: `${id}@colegio.edu`,
    avatar: 'buho',
    creado_en: '2026-11-09T10:00:00Z',
    actualizado_en: '2026-11-09T10:00:00Z',
  }
}

const YO = usuario('yo', 'Directora', 'admin')

/** Imita la base de datos: guarda los usuarios en memoria y aplica los cambios. */
class ServicioFalso implements ServicioUsuarios {
  usuarios: Usuario[]

  constructor(usuarios: Usuario[]) {
    this.usuarios = usuarios
  }

  listar = vi.fn(async () => [...this.usuarios])
  crear = vi.fn(async (datos: NuevoUsuario) => {
    if (this.usuarios.some((u) => u.email === datos.email)) throw new Error('EMAIL_YA_EXISTE')
    const nuevo = { ...usuario(`id-${this.usuarios.length}`, datos.nombre, datos.rol), email: datos.email }
    this.usuarios = [nuevo, ...this.usuarios]
    return nuevo
  })
  actualizar = vi.fn(async (id: string, cambios: CambiosUsuario) => {
    const actual = this.usuarios.find((u) => u.id === id)
    if (!actual) throw new Error('USUARIO_NO_EXISTE')
    const nuevo = { ...actual, ...cambios }
    this.usuarios = this.usuarios.map((u) => (u.id === id ? nuevo : u))
    return nuevo
  })
  enviarRecuperacion = vi.fn(async () => {})
}

function abrir(servicio: ServicioUsuarios) {
  return render(
    <AuthProvider servicio={null}>
      <PanelAdmin servicio={servicio} yo={YO} />
    </AuthProvider>,
  )
}

const lista = () => screen.getByRole('list', { name: 'Usuarios' })
const filaDe = (nombre: string) => within(lista()).getByText(nombre).closest('li') as HTMLElement
const nombresVisibles = () =>
  within(lista())
    .getAllByRole('listitem')
    .map((li) => li.querySelector('p')?.firstChild?.textContent)

function datosIniciales() {
  return new ServicioFalso([
    YO,
    usuario('ana', 'Ana', 'alumno'),
    usuario('maria', 'María José', 'docente'),
    usuario('beto', 'Beto', 'alumno', false),
  ])
}

afterEach(cleanup)

describe('panel de administración', () => {
  it('muestra la lista y el resumen por rol', async () => {
    abrir(datosIniciales())
    await screen.findByRole('heading', { name: 'Usuarios' })
    expect(nombresVisibles()).toEqual(['Directora', 'Ana', 'María José', 'Beto'])
    const resumen = screen.getByText('Desactivados').closest('div') as HTMLElement
    expect(within(resumen).getByText('1')).toBeTruthy()
  })

  it('busca sin tildes y filtra por rol y estado', async () => {
    abrir(datosIniciales())
    await screen.findByRole('heading', { name: 'Usuarios' })

    fireEvent.change(screen.getByRole('searchbox', { name: /buscar/i }), { target: { value: 'maria' } })
    expect(nombresVisibles()).toEqual(['María José'])

    fireEvent.change(screen.getByRole('searchbox', { name: /buscar/i }), { target: { value: '' } })
    fireEvent.change(screen.getByRole('combobox', { name: /rol/i }), { target: { value: 'alumno' } })
    expect(nombresVisibles()).toEqual(['Ana', 'Beto'])

    fireEvent.change(screen.getByRole('combobox', { name: /estado/i }), { target: { value: 'activos' } })
    expect(nombresVisibles()).toEqual(['Ana'])

    fireEvent.change(screen.getByRole('searchbox', { name: /buscar/i }), { target: { value: 'zzz' } })
    expect(screen.getByText('Ningún usuario coincide con la búsqueda.')).toBeTruthy()
  })

  it('crea un usuario con rol docente', async () => {
    const servicio = datosIniciales()
    abrir(servicio)
    await screen.findByRole('heading', { name: 'Usuarios' })
    fireEvent.click(screen.getByRole('button', { name: /nuevo usuario/i }))
    const dialogo = screen.getByRole('dialog', { name: 'Nuevo usuario' })

    fireEvent.change(within(dialogo).getByLabelText('Nombre'), { target: { value: '  Luis   Pérez ' } })
    fireEvent.change(within(dialogo).getByLabelText('Correo'), { target: { value: 'Luis@Colegio.edu' } })
    fireEvent.change(within(dialogo).getByLabelText(/contraseña inicial/i), { target: { value: 'corta' } })
    fireEvent.change(within(dialogo).getByLabelText('Rol'), { target: { value: 'docente' } })
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Crear cuenta' }))
    expect(within(dialogo).getByRole('alert').textContent).toMatch(/al menos 8/)
    expect(servicio.crear).not.toHaveBeenCalled()

    fireEvent.change(within(dialogo).getByLabelText(/contraseña inicial/i), { target: { value: 'bienvenido1' } })
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Crear cuenta' }))

    expect(await screen.findByText(/cuenta creada para luis pérez \(docente\)/i)).toBeTruthy()
    expect(servicio.crear).toHaveBeenCalledWith({
      nombre: 'Luis Pérez',
      email: 'luis@colegio.edu',
      password: 'bienvenido1',
      rol: 'docente',
    })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(nombresVisibles()[0]).toBe('Luis Pérez')
  })

  it('si el correo ya existe, lo dice dentro del diálogo', async () => {
    abrir(datosIniciales())
    await screen.findByRole('heading', { name: 'Usuarios' })
    fireEvent.click(screen.getByRole('button', { name: /nuevo usuario/i }))
    const dialogo = screen.getByRole('dialog')
    fireEvent.change(within(dialogo).getByLabelText('Nombre'), { target: { value: 'Otra Ana' } })
    fireEvent.change(within(dialogo).getByLabelText('Correo'), { target: { value: 'ana@colegio.edu' } })
    fireEvent.change(within(dialogo).getByLabelText(/contraseña inicial/i), { target: { value: 'bienvenido1' } })
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Crear cuenta' }))
    expect(await within(dialogo).findByText(/ya existe una cuenta con ese correo/i)).toBeTruthy()
  })

  it('edita el rol enviando solo lo que cambió', async () => {
    const servicio = datosIniciales()
    abrir(servicio)
    await screen.findByRole('heading', { name: 'Usuarios' })
    fireEvent.click(screen.getByRole('button', { name: 'Editar a Ana' }))
    const dialogo = screen.getByRole('dialog', { name: 'Editar usuario' })
    fireEvent.change(within(dialogo).getByLabelText('Rol'), { target: { value: 'docente' } })
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(servicio.actualizar).toHaveBeenCalledWith('ana', { rol: 'docente' })
    expect(within(filaDe('Ana')).getByText('Docente')).toBeTruthy()
  })

  it('el admin no puede cambiar su propio rol ni desactivarse', async () => {
    abrir(datosIniciales())
    await screen.findByRole('heading', { name: 'Usuarios' })
    expect((screen.getByRole('button', { name: 'Desactivar a Directora' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Editar a Directora' }))
    expect((within(screen.getByRole('dialog')).getByLabelText('Rol') as HTMLSelectElement).disabled).toBe(true)
  })

  it('desactiva tras confirmar y vuelve a activar', async () => {
    const servicio = datosIniciales()
    abrir(servicio)
    await screen.findByRole('heading', { name: 'Usuarios' })

    fireEvent.click(screen.getByRole('button', { name: 'Desactivar a Ana' }))
    expect(servicio.actualizar).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Sí, desactivar' }))

    expect(await screen.findByText(/ana quedó desactivado/i)).toBeTruthy()
    expect(servicio.actualizar).toHaveBeenCalledWith('ana', { activo: false })
    expect(within(filaDe('Ana')).getByText('Desactivado')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Activar a Ana' }))
    expect(await screen.findByText(/ana vuelve a estar activo/i)).toBeTruthy()
  })

  it('muestra el error del servidor si una acción falla', async () => {
    const servicio = datosIniciales()
    servicio.actualizar.mockRejectedValueOnce({ code: 'P0001', message: 'SOLO_ADMIN' })
    abrir(servicio)
    await screen.findByRole('heading', { name: 'Usuarios' })
    fireEvent.click(screen.getByRole('button', { name: 'Activar a Beto' }))
    expect(await screen.findByText(/solo un administrador puede hacer esto/i)).toBeTruthy()
  })

  it('envía el correo para cambiar la contraseña', async () => {
    const servicio = datosIniciales()
    abrir(servicio)
    await screen.findByRole('heading', { name: 'Usuarios' })
    fireEvent.click(screen.getByRole('button', { name: /enviar a maría josé el correo/i }))
    expect(await screen.findByText(/se envió a maria@colegio.edu/i)).toBeTruthy()
    expect(servicio.enviarRecuperacion).toHaveBeenCalledWith('maria@colegio.edu')
  })

  it('si no carga la lista, permite reintentar', async () => {
    const servicio = datosIniciales()
    servicio.listar.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    abrir(servicio)
    expect(await screen.findByText('No hay conexión con el servidor.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /reintentar/i }))
    expect(await screen.findByRole('heading', { name: 'Usuarios' })).toBeTruthy()
  })
})
