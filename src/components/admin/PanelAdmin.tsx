import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../auth/contexto'
import { mensajeDeError } from '../../supabase/errores'
import type { ServicioEstadisticas } from '../../supabase/servicioEstadisticas'
import type { CambiosUsuario, NuevoUsuario, ServicioUsuarios } from '../../supabase/servicioUsuarios'
import ResumenSistema from '../estadisticas/ResumenSistema'
import type { Rol, Usuario } from '../../supabase/tipos'
import { NOMBRE_ROL } from '../../utils/acceso'
import { emojiAvatar } from '../../utils/avatares'
import {
  FILTROS_INICIALES,
  filtrarUsuarios,
  reemplazarUsuario,
  resumirUsuarios,
  type FiltrosUsuarios,
} from '../../utils/usuariosAdmin'
import SecondaryButton from '../SecondaryButton'
import StatusMessage from '../StatusMessage'
import DialogoUsuario from './DialogoUsuario'

interface PanelAdminProps {
  servicio: ServicioUsuarios
  /** El admin que está usando el panel. */
  yo: Usuario
  /** Para el resumen del sistema (opcional). */
  estadisticas?: ServicioEstadisticas | null
}

type Carga = { estado: 'cargando' } | { estado: 'listo'; usuarios: Usuario[] } | { estado: 'error'; mensaje: string }
type Dialogo = { modo: 'crear' } | { modo: 'editar'; usuario: Usuario } | null
type Aviso = { tipo: 'ok' | 'error'; texto: string } | null

const COLOR_ROL: Record<Rol, string> = {
  admin: 'bg-rose-100 text-rose-800',
  docente: 'bg-amber-100 text-amber-900',
  alumno: 'bg-sky-100 text-sky-800',
}

const claseFiltro =
  'rounded-full border-2 border-white/40 bg-white/95 px-4 py-2 text-base font-semibold text-indigo-900 outline-none focus:border-amber-300 focus:ring-4 focus:ring-amber-300/40'

const claseAccionFila =
  'rounded-full px-3 py-1.5 text-sm font-bold ring-2 transition-colors focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 disabled:cursor-not-allowed disabled:opacity-40'

function Resumen({ usuarios }: { usuarios: Usuario[] }) {
  const r = resumirUsuarios(usuarios)
  const datos: [string, number][] = [
    ['Usuarios', r.total],
    ['Alumnos', r.alumno],
    ['Docentes', r.docente],
    ['Admins', r.admin],
    ['Desactivados', r.inactivos],
  ]
  return (
    <dl className="grid w-full grid-cols-3 gap-2 sm:grid-cols-5 sm:gap-3">
      {datos.map(([etiqueta, valor]) => (
        <div key={etiqueta} className="rounded-2xl bg-white/15 px-3 py-2 text-left ring-1 ring-white/20 backdrop-blur sm:px-4 sm:py-3">
          <dt className="truncate text-[0.65rem] font-semibold tracking-widest text-amber-200 uppercase sm:text-xs">{etiqueta}</dt>
          <dd className="text-2xl font-bold text-white tabular-nums sm:text-3xl">{valor}</dd>
        </div>
      ))}
    </dl>
  )
}

interface FilaUsuarioProps {
  usuario: Usuario
  esUnoMismo: boolean
  alEditar: () => void
  alCambiarActivo: (activo: boolean) => Promise<void>
  alEnviarRecuperacion: () => Promise<void>
}

function FilaUsuario({ usuario, esUnoMismo, alEditar, alCambiarActivo, alEnviarRecuperacion }: FilaUsuarioProps) {
  const [confirmando, setConfirmando] = useState(false)
  const [ocupado, setOcupado] = useState(false)

  const ejecutar = async (accion: () => Promise<void>) => {
    setOcupado(true)
    try {
      await accion()
    } finally {
      setOcupado(false)
      setConfirmando(false)
    }
  }

  return (
    <li className={`flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3 sm:px-5 ${usuario.activo ? '' : 'bg-indigo-50/70'}`}>
      <span className="text-3xl" aria-hidden="true">
        {emojiAvatar(usuario.avatar)}
      </span>
      <div className="min-w-0 flex-1 text-left">
        <p className={`truncate font-bold ${usuario.activo ? 'text-indigo-950' : 'text-indigo-400 line-through'}`}>
          {usuario.nombre}
          {esUnoMismo && <span className="ml-2 text-xs font-semibold text-indigo-400 no-underline">(tú)</span>}
        </p>
        <p className="truncate text-sm text-indigo-500">{usuario.email}</p>
      </div>
      <div className="flex items-center gap-2">
        <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${COLOR_ROL[usuario.rol]}`}>
          {NOMBRE_ROL[usuario.rol]}
        </span>
        {!usuario.activo && (
          <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-bold text-slate-700 uppercase">Desactivado</span>
        )}
      </div>

      <div className="flex w-full flex-wrap justify-end gap-2 sm:w-auto">
        {confirmando ? (
          <>
            <span className="self-center text-sm font-semibold text-rose-700">¿Desactivar a {usuario.nombre}?</span>
            <button
              type="button"
              disabled={ocupado}
              onClick={() => void ejecutar(() => alCambiarActivo(false))}
              className={`${claseAccionFila} bg-rose-600 text-white ring-rose-600 hover:bg-rose-500`}
            >
              Sí, desactivar
            </button>
            <button
              type="button"
              onClick={() => setConfirmando(false)}
              className={`${claseAccionFila} text-indigo-700 ring-indigo-200 hover:bg-indigo-50`}
            >
              No
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={alEditar}
              aria-label={`Editar a ${usuario.nombre}`}
              className={`${claseAccionFila} text-indigo-700 ring-indigo-200 hover:bg-indigo-50`}
            >
              ✏️ Editar
            </button>
            <button
              type="button"
              disabled={ocupado}
              onClick={() => void ejecutar(alEnviarRecuperacion)}
              aria-label={`Enviar a ${usuario.nombre} el correo para cambiar la contraseña`}
              title="Enviar el correo para elegir una contraseña nueva"
              className={`${claseAccionFila} text-indigo-700 ring-indigo-200 hover:bg-indigo-50`}
            >
              📨 Contraseña
            </button>
            {usuario.activo ? (
              <button
                type="button"
                disabled={esUnoMismo || ocupado}
                title={esUnoMismo ? 'No puedes desactivar tu propia cuenta' : undefined}
                onClick={() => setConfirmando(true)}
                aria-label={`Desactivar a ${usuario.nombre}`}
                className={`${claseAccionFila} text-rose-700 ring-rose-200 hover:bg-rose-50`}
              >
                🚫 Desactivar
              </button>
            ) : (
              <button
                type="button"
                disabled={ocupado}
                onClick={() => void ejecutar(() => alCambiarActivo(true))}
                aria-label={`Activar a ${usuario.nombre}`}
                className={`${claseAccionFila} text-emerald-700 ring-emerald-200 hover:bg-emerald-50`}
              >
                ✅ Activar
              </button>
            )}
          </>
        )}
      </div>
    </li>
  )
}

/** CRUD de usuarios: buscar, crear, editar nombre y rol, activar/desactivar y recuperar contraseña. */
function PanelAdmin({ servicio, yo, estadisticas = null }: PanelAdminProps) {
  const { refrescarPerfil } = useAuth()
  const [carga, setCarga] = useState<Carga>({ estado: 'cargando' })
  const [filtros, setFiltros] = useState<FiltrosUsuarios>(FILTROS_INICIALES)
  const [dialogo, setDialogo] = useState<Dialogo>(null)
  const [aviso, setAviso] = useState<Aviso>(null)
  const [intento, setIntento] = useState(0)

  useEffect(() => {
    let cancelado = false
    servicio.listar().then(
      (usuarios) => !cancelado && setCarga({ estado: 'listo', usuarios }),
      (error: unknown) => {
        console.error('No se pudo cargar la lista de usuarios', error)
        if (!cancelado) setCarga({ estado: 'error', mensaje: mensajeDeError(error, 'No se pudo cargar la lista de usuarios.') })
      },
    )
    return () => {
      cancelado = true
    }
  }, [servicio, intento])

  const usuarios = carga.estado === 'listo' ? carga.usuarios : null
  const visibles = useMemo(() => (usuarios ? filtrarUsuarios(usuarios, filtros) : []), [usuarios, filtros])

  const guardarEnLista = useCallback((usuario: Usuario) => {
    setCarga((actual) => (actual.estado === 'listo' ? { estado: 'listo', usuarios: reemplazarUsuario(actual.usuarios, usuario) } : actual))
  }, [])

  const actualizar = useCallback(
    async (id: string, cambios: CambiosUsuario, textoOk: string) => {
      const usuario = await servicio.actualizar(id, cambios)
      guardarEnLista(usuario)
      setAviso({ tipo: 'ok', texto: textoOk })
      // Si el admin cambió su propio nombre, que se vea también en la esquina.
      if (id === yo.id) void refrescarPerfil()
    },
    [servicio, guardarEnLista, yo.id, refrescarPerfil],
  )

  /** Las acciones de las filas muestran su error en el aviso del panel. */
  const conAviso = useCallback(async (accion: () => Promise<void>) => {
    try {
      await accion()
    } catch (error) {
      console.error(error)
      setAviso({ tipo: 'error', texto: mensajeDeError(error, 'No se pudo completar la acción.') })
    }
  }, [])

  const cerrarDialogo = useCallback(() => setDialogo(null), [])

  if (carga.estado === 'cargando') return <StatusMessage icon="⏳" title="Cargando usuarios…" />
  if (carga.estado === 'error') {
    return (
      <StatusMessage icon="📡" title="No se pudo cargar la lista">
        <p>{carga.mensaje}</p>
        <SecondaryButton
          onClick={() => {
            setCarga({ estado: 'cargando' })
            setIntento((n) => n + 1)
          }}
        >
          🔄 Reintentar
        </SecondaryButton>
      </StatusMessage>
    )
  }

  return (
    <section className="flex w-full max-w-5xl flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3 text-left">
        <div>
          <p className="text-sm font-semibold tracking-widest text-amber-200 uppercase">Panel de administración</p>
          <h1 className="text-4xl font-bold text-white drop-shadow-[0_3px_0_rgba(0,0,0,0.2)]">Usuarios</h1>
        </div>
        <a href="#/cuenta" className="font-semibold text-white underline decoration-white/40 underline-offset-4 hover:decoration-amber-300">
          ⬅ Mi cuenta
        </a>
      </header>

      {estadisticas && <ResumenSistema servicio={estadisticas} />}

      <Resumen usuarios={carga.usuarios} />

      <div className="flex flex-wrap items-center gap-3" role="search">
        <input
          type="search"
          value={filtros.texto}
          onChange={(e) => setFiltros({ ...filtros, texto: e.target.value })}
          placeholder="Buscar por nombre o correo…"
          aria-label="Buscar por nombre o correo"
          className={`${claseFiltro} min-w-0 flex-1 basis-56`}
        />
        <select
          value={filtros.rol}
          onChange={(e) => setFiltros({ ...filtros, rol: e.target.value as FiltrosUsuarios['rol'] })}
          aria-label="Filtrar por rol"
          className={`${claseFiltro} flex-1 sm:flex-none`}
        >
          <option value="todos">Todos los roles</option>
          <option value="alumno">Alumnos</option>
          <option value="docente">Docentes</option>
          <option value="admin">Admins</option>
        </select>
        <select
          value={filtros.estado}
          onChange={(e) => setFiltros({ ...filtros, estado: e.target.value as FiltrosUsuarios['estado'] })}
          aria-label="Filtrar por estado"
          className={`${claseFiltro} flex-1 sm:flex-none`}
        >
          <option value="todos">Activos y desactivados</option>
          <option value="activos">Solo activos</option>
          <option value="inactivos">Solo desactivados</option>
        </select>
        <button
          type="button"
          onClick={() => setDialogo({ modo: 'crear' })}
          className="rounded-full bg-amber-400 px-5 py-2 text-base font-bold text-amber-950 shadow-[0_4px_0_0_var(--color-amber-600)] hover:bg-amber-300 focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-white active:translate-y-1 active:shadow-none"
        >
          ➕ Nuevo usuario
        </button>
      </div>

      <div className="min-h-6" role="status" aria-live="polite">
        {aviso && (
          <p className={`text-left font-semibold ${aviso.tipo === 'ok' ? 'text-emerald-100' : 'text-rose-200'}`}>
            {aviso.tipo === 'ok' ? '✅' : '⚠️'} {aviso.texto}
          </p>
        )}
      </div>

      <div className="overflow-hidden rounded-3xl bg-white shadow-[0_6px_0_0_rgba(0,0,0,0.15)]">
        {visibles.length === 0 ? (
          <p className="px-5 py-10 text-center text-indigo-500">Ningún usuario coincide con la búsqueda.</p>
        ) : (
          <ul className="divide-y divide-indigo-100" aria-label="Usuarios">
            {visibles.map((u) => (
              <FilaUsuario
                key={u.id}
                usuario={u}
                esUnoMismo={u.id === yo.id}
                alEditar={() => setDialogo({ modo: 'editar', usuario: u })}
                alCambiarActivo={(activo) =>
                  conAviso(() =>
                    actualizar(u.id, { activo }, activo ? `${u.nombre} vuelve a estar activo.` : `${u.nombre} quedó desactivado.`),
                  )
                }
                alEnviarRecuperacion={() =>
                  conAviso(async () => {
                    await servicio.enviarRecuperacion(u.email)
                    setAviso({ tipo: 'ok', texto: `Se envió a ${u.email} el correo para elegir una contraseña nueva.` })
                  })
                }
              />
            ))}
          </ul>
        )}
      </div>
      {visibles.length > 0 && visibles.length < carga.usuarios.length && (
        <p className="text-left text-sm text-indigo-100">
          Mostrando {visibles.length} de {carga.usuarios.length} usuarios.
        </p>
      )}

      {dialogo?.modo === 'crear' && (
        <DialogoUsuario
          modo="crear"
          alCerrar={cerrarDialogo}
          alGuardar={async (datos: NuevoUsuario) => {
            const usuario = await servicio.crear(datos)
            guardarEnLista(usuario)
            setDialogo(null)
            setAviso({ tipo: 'ok', texto: `Cuenta creada para ${usuario.nombre} (${NOMBRE_ROL[usuario.rol].toLowerCase()}).` })
          }}
        />
      )}
      {dialogo?.modo === 'editar' && (
        <DialogoUsuario
          modo="editar"
          usuario={dialogo.usuario}
          esUnoMismo={dialogo.usuario.id === yo.id}
          alCerrar={cerrarDialogo}
          alGuardar={async (cambios) => {
            if (Object.keys(cambios).length > 0) {
              await actualizar(dialogo.usuario.id, cambios, `Se guardaron los cambios de ${cambios.nombre ?? dialogo.usuario.nombre}.`)
            }
            setDialogo(null)
          }}
        />
      )}
    </section>
  )
}

export default PanelAdmin
