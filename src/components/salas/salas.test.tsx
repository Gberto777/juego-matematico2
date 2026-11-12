// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CambiosSala, DatosSala, SalaConResumen, ServicioSalas } from '../../supabase/servicioSalas'
import type { EstadoSala, MiembroSala, NuevaRespuesta, Partida, Usuario } from '../../supabase/tipos'
import MisSalas from './MisSalas'
import PanelDocente from './PanelDocente'
import PantallaSalaAlumno from './PantallaSalaAlumno'
import PantallaSalaDocente from './PantallaSalaDocente'

function usuario(id: string, rol: Usuario['rol']): Usuario {
  return { id, rol, nombre: `Nombre ${id}`, email: `${id}@x.edu`, avatar: 'buho', activo: true, creado_en: '', actualizado_en: '' }
}

const DOCENTE = usuario('profe', 'docente')
const ALUMNO = usuario('ana', 'alumno')

function sala(datos: Partial<SalaConResumen> = {}): SalaConResumen {
  return {
    id: 's1',
    codigo: 'SUM-1234',
    nombre: '4.º B',
    docente_id: DOCENTE.id,
    tema: 'suma',
    dificultad: 'media',
    max_jugadores: 30,
    estado: 'abierta',
    creado_en: '2026-11-09T10:00:00Z',
    cerrada_en: null,
    docente_nombre: DOCENTE.nombre,
    miembros: 0,
    ...datos,
  }
}

function miembro(id: string, datos: Partial<MiembroSala> = {}): MiembroSala {
  return {
    usuario_id: id,
    nombre: `Alumno ${id}`,
    avatar: 'zorro',
    unido_en: new Date().toISOString(),
    ultima_actividad: new Date().toISOString(),
    conectado: true,
    jugando: false,
    puntos: null,
    nivel: null,
    vidas: null,
    partidas_terminadas: 0,
    mejor_puntos: 0,
    ...datos,
  }
}

/** Base de datos en memoria con la misma interfaz que Supabase. */
class SalasFalsas implements ServicioSalas {
  salas: SalaConResumen[]
  listaMiembros: MiembroSala[] = []
  estadoLatido: EstadoSala | null = 'abierta'
  alCambiarSala: (() => void) | null = null

  constructor(salas: SalaConResumen[] = []) {
    this.salas = salas
  }

  listar = vi.fn(async () => [...this.salas])
  buscarPorCodigo = vi.fn(async (codigo: string) => this.salas.find((s) => s.codigo === codigo) ?? null)
  crear = vi.fn(async (datos: DatosSala) => {
    const nueva = sala({ ...datos, id: `s${this.salas.length + 2}`, codigo: 'MUL-4821' })
    this.salas = [nueva, ...this.salas]
    return nueva
  })
  actualizarSala = vi.fn(async (id: string, cambios: CambiosSala) => {
    const actual = { ...this.salas.find((s) => s.id === id)!, ...cambios }
    this.salas = this.salas.map((s) => (s.id === id ? actual : s))
    return actual
  })
  borrar = vi.fn(async (id: string) => {
    this.salas = this.salas.filter((s) => s.id !== id)
  })
  miembros = vi.fn(async () => [...this.listaMiembros])
  expulsar = vi.fn(async (_salaId: string, usuarioId: string) => {
    this.listaMiembros = this.listaMiembros.filter((m) => m.usuario_id !== usuarioId)
  })
  unirse = vi.fn(async (codigo: string) => {
    const encontrada = this.salas.find((s) => s.codigo === codigo)
    if (!encontrada) throw { code: 'P0001', message: 'SALA_NO_EXISTE' }
    return encontrada
  })
  salir = vi.fn(async () => {})
  latido = vi.fn(async () => this.estadoLatido)
  escucharSala = vi.fn((_salaId: string, alCambiar: () => void) => {
    this.alCambiarSala = alCambiar
    return () => {
      this.alCambiarSala = null
    }
  })
  retos = vi.fn(async () => [])
  progresoReto = vi.fn(async () => [])
  crearReto = vi.fn(async () => {})
  borrarReto = vi.fn(async () => {})
  iniciar = vi.fn(async () => ({ id: 'partida-1' }) as Partida)
  enviarRespuestas = vi.fn(async (_respuestas: NuevaRespuesta[]) => {})
  actualizar = vi.fn(async () => ({ partida: { id: 'partida-1' } as Partida, logros_nuevos: [] }))
}

afterEach(() => {
  cleanup()
  window.location.hash = ''
})

describe('panel docente', () => {
  it('crea una sala y muestra su código', async () => {
    const servicio = new SalasFalsas()
    render(<PanelDocente servicio={servicio} yo={DOCENTE} />)
    expect(await screen.findByText(/aún no tienes salas/i)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /nueva sala/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Crear sala' }))
    expect(screen.getByRole('alert').textContent).toMatch(/ponle un nombre/i)

    fireEvent.change(screen.getByLabelText('Nombre de la sala'), { target: { value: '  5.º A  ' } })
    fireEvent.change(screen.getByLabelText('Tema'), { target: { value: 'multiplicacion' } })
    fireEvent.change(screen.getByLabelText('Dificultad'), { target: { value: 'dificil' } })
    fireEvent.change(screen.getByLabelText('Límite de jugadores'), { target: { value: '25' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear sala' }))

    expect(await screen.findByText(/comparte el código MUL-4821/i)).toBeTruthy()
    expect(servicio.crear).toHaveBeenCalledWith({ nombre: '5.º A', tema: 'multiplicacion', dificultad: 'dificil', max_jugadores: 25 })
    expect(within(screen.getByRole('list', { name: 'Salas' })).getByText('MUL-4821')).toBeTruthy()
  })

  it('rechaza un límite de jugadores fuera de rango', async () => {
    const servicio = new SalasFalsas()
    render(<PanelDocente servicio={servicio} yo={DOCENTE} />)
    fireEvent.click(await screen.findByRole('button', { name: /nueva sala/i }))
    fireEvent.change(screen.getByLabelText('Nombre de la sala'), { target: { value: 'Sala' } })
    fireEvent.change(screen.getByLabelText('Límite de jugadores'), { target: { value: '500' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear sala' }))
    expect(screen.getByRole('alert').textContent).toMatch(/entre 1 y 100/)
    expect(servicio.crear).not.toHaveBeenCalled()
  })

  it('cierra, abre y borra (con confirmación) una sala', async () => {
    const servicio = new SalasFalsas([sala({ miembros: 3 })])
    render(<PanelDocente servicio={servicio} yo={DOCENTE} />)
    expect(await screen.findByText('👥 3/30')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar la sala SUM-1234' }))
    expect(await screen.findByText(/está cerrada: nadie más puede entrar/i)).toBeTruthy()
    expect(servicio.actualizarSala).toHaveBeenCalledWith('s1', { estado: 'cerrada' })

    fireEvent.click(screen.getByRole('button', { name: 'Abrir la sala SUM-1234' }))
    expect(await screen.findByText(/vuelve a estar abierta/i)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Borrar la sala SUM-1234' }))
    expect(servicio.borrar).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Sí, borrar' }))
    expect(await screen.findByText(/se borró la sala/i)).toBeTruthy()
    expect(screen.queryByRole('list', { name: 'Salas' })).toBeNull()
  })

  it('el admin ve de quién es cada sala', async () => {
    const servicio = new SalasFalsas([sala()])
    render(<PanelDocente servicio={servicio} yo={usuario('root', 'admin')} />)
    expect(await screen.findByRole('heading', { name: 'Todas las salas' })).toBeTruthy()
    expect(screen.getByText(`Docente: ${DOCENTE.nombre}`)).toBeTruthy()
  })
})

describe('sala del docente', () => {
  it('muestra el código, quién está conectado y qué hace cada uno', async () => {
    const servicio = new SalasFalsas([sala()])
    servicio.listaMiembros = [
      miembro('1', { nombre: 'Beatriz', jugando: true, puntos: 40, nivel: 2, vidas: 2 }),
      miembro('2', { nombre: 'Abel', conectado: false, ultima_actividad: new Date(Date.now() - 600_000).toISOString() }),
    ]
    render(<PantallaSalaDocente servicio={servicio} codigo="SUM-1234" />)

    expect(await screen.findByText('SUM-1234')).toBeTruthy()
    expect(screen.getByText(/1 conectados · 🎮 1 jugando · 👥 2\/30/)).toBeTruthy()
    const lista = screen.getByRole('list', { name: 'Alumnos de la sala' })
    expect(within(lista).getByText(/nivel 2 · 40 pts/)).toBeTruthy()
    expect(within(lista).getByText('Visto hace 10 min')).toBeTruthy()
  })

  it('se actualiza sola cuando Supabase avisa de un cambio', async () => {
    const servicio = new SalasFalsas([sala()])
    render(<PantallaSalaDocente servicio={servicio} codigo="SUM-1234" />)
    expect(await screen.findByText(/todavía no ha entrado nadie/i)).toBeTruthy()
    await waitFor(() => expect(servicio.alCambiarSala).not.toBeNull())

    servicio.listaMiembros = [miembro('1', { nombre: 'Carla' })]
    await act(async () => servicio.alCambiarSala?.())
    expect(await screen.findByText('Carla')).toBeTruthy()
  })

  it('quita a un alumno tras confirmar', async () => {
    const servicio = new SalasFalsas([sala()])
    servicio.listaMiembros = [miembro('1', { nombre: 'Carla' })]
    render(<PantallaSalaDocente servicio={servicio} codigo="SUM-1234" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Quitar a Carla de la sala' }))
    fireEvent.click(screen.getByRole('button', { name: 'Sí, quitar' }))
    expect(await screen.findByText(/carla ya no está en la sala/i)).toBeTruthy()
    expect(servicio.expulsar).toHaveBeenCalledWith('s1', '1')
  })

  it('si la sala no existe (o no es suya), lo dice', async () => {
    render(<PantallaSalaDocente servicio={new SalasFalsas()} codigo="SUM-9999" />)
    expect(await screen.findByRole('heading', { name: 'No se encontró la sala' })).toBeTruthy()
  })
})

describe('alumno', () => {
  it('valida el código y entra a la sala', async () => {
    const servicio = new SalasFalsas([sala()])
    render(<MisSalas servicio={servicio} />)
    const campo = await screen.findByLabelText('Código de la sala')

    fireEvent.change(campo, { target: { value: 'sum12' } })
    fireEvent.click(screen.getByRole('button', { name: /entrar a la sala/i }))
    expect(screen.getByRole('alert').textContent).toMatch(/3 letras y 4 números/)

    fireEvent.change(campo, { target: { value: 'sum1234' } })
    expect((campo as HTMLInputElement).value).toBe('SUM-1234')
    fireEvent.click(screen.getByRole('button', { name: /entrar a la sala/i }))
    await waitFor(() => expect(window.location.hash).toBe('#/salas/SUM-1234'))
    expect(servicio.unirse).toHaveBeenCalledWith('SUM-1234')
  })

  it('traduce los errores al unirse', async () => {
    render(<MisSalas servicio={new SalasFalsas()} />)
    fireEvent.change(await screen.findByLabelText('Código de la sala'), { target: { value: 'MUL-0000' } })
    fireEvent.click(screen.getByRole('button', { name: /entrar a la sala/i }))
    expect(await screen.findByText(/no existe ninguna sala con ese código/i)).toBeTruthy()
  })

  it('juega en la sala y cada respuesta se envía con su operación', async () => {
    const servicio = new SalasFalsas([sala()])
    render(<PantallaSalaAlumno servicio={servicio} codigo="SUM-1234" yo={ALUMNO} />)
    expect(await screen.findByText(/jugando como/i)).toBeTruthy()
    await waitFor(() => expect(servicio.latido).toHaveBeenCalledWith('s1'))

    fireEvent.click(screen.getByRole('button', { name: /comenzar juego/i }))
    await waitFor(() => expect(servicio.iniciar).toHaveBeenCalledWith({ origen: 'web', nivelInicial: 1, salaId: 's1' }))

    const pregunta = screen.getByLabelText(/¿cuánto es/i).getAttribute('aria-label') ?? ''
    const [, a, b] = /(\d+) \+ (\d+)/.exec(pregunta) ?? []
    fireEvent.change(screen.getByLabelText('Tu respuesta'), { target: { value: String(Number(a) + Number(b)) } })
    fireEvent.click(screen.getByRole('button', { name: 'Responder' }))

    await waitFor(() => expect(servicio.actualizar).toHaveBeenCalled())
    expect(servicio.enviarRespuestas.mock.calls[0][0]).toEqual([
      expect.objectContaining({ partida_id: 'partida-1', operacion: 'suma', a: Number(a), b: Number(b), respuesta: Number(a) + Number(b) }),
    ])
    expect(servicio.actualizar).toHaveBeenCalledWith('partida-1', { puntos: 10, nivel: 1, vidas: 3, terminar: false })
  })

  it('el alumno ve los retos de su docente y juega uno', async () => {
    const servicio = new SalasFalsas([sala()])
    servicio.retos.mockResolvedValue([
      {
        id: 'r1',
        titulo: 'Tablas del 7',
        descripcion: 'Para el viernes',
        tema: 'multiplicacion',
        dificultad: 'media',
        meta_aciertos: 15,
        fecha_limite: null,
        creado_en: '',
        cumplidos: 0,
        miembros: 3,
        mi_mejor: 6,
        cumplido_por_mi: false,
      },
    ] as never)
    render(<PantallaSalaAlumno servicio={servicio} codigo="SUM-1234" yo={ALUMNO} />)
    expect(await screen.findByText('Tu mejor: 6 de 15')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Jugar el reto Tablas del 7' }))
    await waitFor(() =>
      expect(servicio.iniciar).toHaveBeenCalledWith({ origen: 'web', nivelInicial: 3, salaId: 's1', retoId: 'r1', modo: undefined }),
    )
    expect(await screen.findByText(/tablas del 7: 0 de 15 aciertos/i)).toBeTruthy()
  })

  it('si el docente lo quitó de la sala, se lo dice', async () => {
    const servicio = new SalasFalsas([sala()])
    servicio.estadoLatido = null
    render(<PantallaSalaAlumno servicio={servicio} codigo="SUM-1234" yo={ALUMNO} />)
    expect(await screen.findByRole('heading', { name: 'Ya no estás en esta sala' })).toBeTruthy()
  })

  it('avisa si la sala está cerrada', async () => {
    const servicio = new SalasFalsas([sala()])
    servicio.estadoLatido = 'cerrada'
    render(<PantallaSalaAlumno servicio={servicio} codigo="SUM-1234" yo={ALUMNO} />)
    expect(await screen.findByText(/la sala está cerrada: tus resultados ya no se envían/i)).toBeTruthy()
  })

  it('el docente que abre el enlace de su propia sala va a su panel', async () => {
    render(<PantallaSalaAlumno servicio={new SalasFalsas([sala()])} codigo="SUM-1234" yo={DOCENTE} />)
    expect(await screen.findByRole('heading', { name: 'Esta sala es tuya' })).toBeTruthy()
    expect(screen.getByRole('link', { name: /abrir el panel/i }).getAttribute('href')).toBe('#/docente/sala/SUM-1234')
  })
})
