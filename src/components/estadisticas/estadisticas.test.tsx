// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../../auth/AuthProvider'
import type { ServicioAuth } from '../../supabase/servicioAuth'
import type { ServicioEstadisticas } from '../../supabase/servicioEstadisticas'
import type { ApiPartidas, ServicioSalas } from '../../supabase/servicioSalas'
import type { Partida, RetoConProgreso, Sala, Usuario } from '../../supabase/tipos'
import SoloGame from '../SoloGame'
import PanelProgreso from './PanelProgreso'
import PanelRetos from './PanelRetos'
import PantallaPerfil from './PantallaPerfil'
import { TablaRanking } from './Ranking'
import ResumenSistema from './ResumenSistema'

const ANA: Usuario = {
  id: 'ana',
  nombre: 'Ana',
  email: 'ana@x.edu',
  rol: 'alumno',
  avatar: 'zorro',
  activo: true,
  creado_en: '',
  actualizado_en: '',
}

const SALA: Sala = {
  id: 's1',
  codigo: 'MUL-4821',
  nombre: '4.º B',
  docente_id: 'profe',
  tema: 'multiplicacion',
  dificultad: 'media',
  max_jugadores: 30,
  estado: 'abierta',
  creado_en: '',
  cerrada_en: null,
}

function estadisticasFalsas(): ServicioEstadisticas & Record<string, ReturnType<typeof vi.fn>> {
  return {
    ranking: vi.fn(async (periodo: string) => [
      { posicion: 1, usuario_id: 'beto', nombre: 'Beto', avatar: 'rana', mejor_puntos: periodo === 'global' ? 300 : 80, partidas: 3, es_yo: false },
      { posicion: 2, usuario_id: 'ana', nombre: 'Ana', avatar: 'zorro', mejor_puntos: 50, partidas: 2, es_yo: true },
    ]),
    estadisticasSala: vi.fn(async () => [
      { usuario_id: 'ana', nombre: 'Ana', avatar: 'zorro', partidas: 2, aciertos: 9, respuestas: 10, porcentaje_aciertos: 90, mejor_puntos: 60, nivel_max: 3, ultima_partida: new Date().toISOString() },
      { usuario_id: 'beto', nombre: 'Beto', avatar: 'rana', partidas: 1, aciertos: 2, respuestas: 5, porcentaje_aciertos: 40, mejor_puntos: 20, nivel_max: 1, ultima_partida: null },
    ]),
    erroresPorOperacion: vi.fn(async () => [
      { operacion: 'suma' as const, respuestas: 10, fallos: 1, porcentaje_fallo: 10 },
      { operacion: 'multiplicacion' as const, respuestas: 8, fallos: 6, porcentaje_fallo: 75 },
    ]),
    operacionesDificiles: vi.fn(async () => [{ operacion: 'multiplicacion' as const, a: 7, b: 8, resultado: 56, intentos: 4, fallos: 3 }]),
    estadisticasUsuario: vi.fn(async () => ({
      partidas: 12,
      puntos_max: 250,
      nivel_max: 4,
      aciertos: 90,
      respuestas: 100,
      precision: 90,
      monedas: 37,
      jefe_derrotado: true,
      minutos_jugados: 41,
      por_origen: { web: 10, movil: 0, godot: 2 },
      ultimas: [
        { id: 'p1', origen: 'godot' as const, modo: 'practica' as const, puntos: 250, nivel: 4, aciertos: 20, respuestas_total: 21, jefe_derrotado: true, terminada_en: '2026-11-09T10:00:00Z' },
      ],
    })),
    estadisticasSistema: vi.fn(async () => ({
      usuarios: { total: 40, admin: 1, docente: 3, alumno: 36, inactivos: 2, nuevos_semana: 5 },
      salas: { total: 6, abiertas: 2 },
      partidas: { total: 300, hoy: 12, semana: 80, en_curso: 4, web: 250, movil: 0, godot: 50 },
      respuestas: { total: 5000, precision: 81 },
      por_dia: Array.from({ length: 14 }, (_, i) => ({ fecha: `2026-11-${String(i + 1).padStart(2, '0')}`, partidas: i })),
    })),
    retoDiario: vi.fn(async () => ({ fecha: '2026-11-09', tema: 'resta' as const, dificultad: 'media' as const, meta_aciertos: 15, mi_mejor: 6, completado: false })),
    logros: vi.fn(async () => [
      { id: 'primera_partida', nombre: 'Primeros pasos', descripcion: 'Termina tu primera partida.', icono: '🎮', obtenido_en: '2026-11-01T00:00:00Z' },
      { id: 'rey_derrotado', nombre: 'Salvador del reino', descripcion: 'Derrota al Rey del Caos.', icono: '👑', obtenido_en: null },
    ]),
    actualizarPerfil: vi.fn(async (_id: string, cambios: { nombre?: string; avatar?: string }) => ({ ...ANA, ...cambios })),
  }
}

/** Auth falso con una sesión fija (o sin sesión). */
function auth(usuario: Usuario | null): ServicioAuth {
  return {
    iniciarSesion: vi.fn(),
    registrarse: vi.fn(),
    enviarRecuperacion: vi.fn(),
    cambiarPassword: vi.fn(),
    cerrarSesion: vi.fn(),
    cargarPerfil: vi.fn(async () => usuario),
    escuchar: (alCambiar) => {
      queueMicrotask(() => alCambiar(usuario?.id ?? null, false))
      return () => {}
    },
  }
}

const conAuth = (ui: ReactNode, usuario: Usuario | null = ANA) => render(<AuthProvider servicio={auth(usuario)}>{ui}</AuthProvider>)

afterEach(cleanup)

describe('perfil', () => {
  it('muestra cifras, reto del día, logros e historial', async () => {
    conAuth(<PantallaPerfil servicio={estadisticasFalsas()} usuario={ANA} />)
    // La mejor puntuación sale en su cifra y en la partida del historial.
    expect(await screen.findAllByText('250')).toHaveLength(2)
    expect(screen.getByText('90 %')).toBeTruthy()
    expect(await screen.findByText(/consigue 15 aciertos/)).toBeTruthy()
    expect(screen.getByText('Tu mejor hoy: 6 de 15.')).toBeTruthy()

    const logros = await screen.findByRole('list', { name: 'Logros' })
    expect(within(logros).getByText('Conseguido')).toBeTruthy()
    expect(within(logros).getByText('Sin conseguir')).toBeTruthy()
    expect(screen.getByText('MathQuest 3D')).toBeTruthy()
    expect(screen.getByText(/multiplicaciones/i, { selector: 'strong' })).toBeTruthy()
  })

  it('cambia el nombre y el avatar', async () => {
    const servicio = estadisticasFalsas()
    conAuth(<PantallaPerfil servicio={servicio} usuario={ANA} />)
    fireEvent.click(screen.getByRole('button', { name: /editar perfil/i }))
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: '  Ana  Lucía ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Avatar panda' }))
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(servicio.actualizarPerfil).toHaveBeenCalledWith('ana', { nombre: 'Ana Lucía', avatar: 'panda' }))
  })
})

describe('ranking', () => {
  it('marca mi fila y cambia de periodo', async () => {
    const servicio = estadisticasFalsas()
    render(<TablaRanking servicio={servicio} salaId="s1" />)
    const lista = await screen.findByRole('list', { name: 'Ranking' })
    expect(within(lista).getByText('(tú)')).toBeTruthy()
    expect(servicio.ranking).toHaveBeenCalledWith('semanal', 's1')
    fireEvent.click(screen.getByRole('button', { name: 'Siempre' }))
    expect(await screen.findByText('300')).toBeTruthy()
    expect(servicio.ranking).toHaveBeenLastCalledWith('global', 's1')
  })
})

describe('progreso de la sala', () => {
  it('lista a los alumnos, resalta a quien va mal y exporta a Excel', async () => {
    const descargar = vi.fn(async () => {})
    render(<PanelProgreso servicio={estadisticasFalsas()} sala={SALA} descargar={descargar} />)
    expect(await screen.findByText('40 %')).toBeTruthy()
    expect(screen.getByText('40 %').className).toMatch(/rose/)
    expect(await screen.findByText('7 × 8 = 56')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /exportar a excel/i }))
    expect(await screen.findByText(/se descargó el excel/i)).toBeTruthy()
    const [hojas, archivo] = descargar.mock.calls[0] as unknown as [{ sheet: string; data: unknown[] }[], string]
    expect(hojas.map((h) => h.sheet)).toEqual(['Alumnos', 'Por operación', 'Más falladas'])
    expect(hojas[0].data).toHaveLength(3)
    expect(archivo).toMatch(/^MathQuest-MUL-4821-\d{4}-\d{2}-\d{2}\.xlsx$/)
  })
})

describe('retos del docente', () => {
  function salasFalsas(retos: RetoConProgreso[] = []) {
    return {
      retos: vi.fn(async () => retos),
      progresoReto: vi.fn(async () => [{ usuario_id: 'ana', nombre: 'Ana', mejor_aciertos: 15, intentos: 2, cumplido: true }]),
      crearReto: vi.fn(async () => {}),
      borrarReto: vi.fn(async () => {}),
    } as unknown as ServicioSalas & Record<string, ReturnType<typeof vi.fn>>
  }
  const reto: RetoConProgreso = {
    id: 'r1',
    titulo: 'Tablas del 7',
    descripcion: '',
    tema: 'multiplicacion',
    dificultad: 'media',
    meta_aciertos: 15,
    fecha_limite: null,
    creado_en: '',
    cumplidos: 1,
    miembros: 4,
    mi_mejor: 0,
    cumplido_por_mi: false,
  }

  it('valida y crea un reto', async () => {
    const servicio = salasFalsas()
    render(<PanelRetos servicio={servicio} sala={SALA} />)
    fireEvent.click(screen.getByRole('button', { name: 'Crear reto' }))
    expect(screen.getByRole('alert').textContent).toMatch(/título/)
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Tablas del 7' } })
    fireEvent.change(screen.getByLabelText(/meta de aciertos/i), { target: { value: '20' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear reto' }))
    expect(await screen.findByText(/reto «tablas del 7» creado/i)).toBeTruthy()
    expect(servicio.crearReto).toHaveBeenCalledWith('s1', {
      titulo: 'Tablas del 7',
      descripcion: '',
      tema: 'multiplicacion',
      dificultad: 'media',
      meta_aciertos: 20,
      fecha_limite: null,
    })
  })

  it('muestra cuántos lo cumplieron y el detalle por alumno', async () => {
    render(<PanelRetos servicio={salasFalsas([reto])} sala={SALA} />)
    expect(await screen.findByText('1/4')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /ver quién lo cumplió/i }))
    const detalle = await screen.findByRole('list', { name: 'Progreso en Tablas del 7' })
    expect(within(detalle).getByText('15/15')).toBeTruthy()
  })
})

describe('resumen del sistema', () => {
  it('muestra los totales y las partidas de los últimos 14 días', async () => {
    render(<ResumenSistema servicio={estadisticasFalsas()} />)
    expect(await screen.findByText('40')).toBeTruthy()
    expect(screen.getByText('81 %')).toBeTruthy()
    expect(within(screen.getByRole('list', { name: 'Partidas por día' })).getAllByRole('listitem')).toHaveLength(14)
  })
})

describe('práctica rápida guardando en la cuenta', () => {
  const api = (): ApiPartidas & Record<string, ReturnType<typeof vi.fn>> => ({
    iniciar: vi.fn(async () => ({ id: 'p1' }) as Partida),
    enviarRespuestas: vi.fn(async () => {}),
    actualizar: vi.fn(async () => ({ partida: { id: 'p1' } as Partida, logros_nuevos: [] })),
  })

  it('con sesión, la partida se guarda', async () => {
    const servicio = api()
    conAuth(<SoloGame uid={null} onJoinClass={() => {}} onTeacher={() => {}} api={servicio} />)
    expect(await screen.findByText(/tus partidas se guardan/i)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /comenzar juego/i }))
    await waitFor(() => expect(servicio.iniciar).toHaveBeenCalledWith({ origen: 'web', nivelInicial: 1 }))
  })

  it('sin sesión no se guarda e invita a entrar', async () => {
    const servicio = api()
    conAuth(<SoloGame uid={null} onJoinClass={() => {}} onTeacher={() => {}} api={servicio} />, null)
    expect(await screen.findByRole('link', { name: 'Entra con tu cuenta' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /comenzar juego/i }))
    expect(servicio.iniciar).not.toHaveBeenCalled()
  })

  it('el reto del día empieza en su tema y se guarda en modo diario', async () => {
    const servicio = api()
    const diario = { fecha: '2026-11-09', tema: 'resta' as const, dificultad: 'media' as const, meta_aciertos: 15, mi_mejor: 0, completado: false }
    conAuth(<SoloGame uid={null} onJoinClass={() => {}} onTeacher={() => {}} api={servicio} diario={diario} />)
    expect(await screen.findByText(/consigue/)).toBeTruthy()
    await screen.findByText(/tus partidas se guardan/i)
    fireEvent.click(screen.getByRole('button', { name: /comenzar juego/i }))
    await waitFor(() => expect(servicio.iniciar).toHaveBeenCalledWith({ origen: 'web', nivelInicial: 2, modo: 'diario' }))
    expect(screen.getByText('🎯 Reto del día: 0 de 15 aciertos')).toBeTruthy()
  })
})
