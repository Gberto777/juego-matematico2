import { useEffect, useState } from 'react'
import type { SalaConResumen, ServicioSalas } from '../../supabase/servicioSalas'
import { ICONO_TEMA, NOMBRE_TEMA, esCodigoSalaValido, normalizarCodigoSala } from '../../utils/codigoSala'
import { routeToHash } from '../../utils/routes'
import { CampoTexto, EnlaceTexto, FormularioCuenta } from '../cuenta/Formulario'
import { EstadoSalaInsignia } from './PanelDocente'

interface MisSalasProps {
  servicio: ServicioSalas
}

/** El alumno entra a una sala con su código y ve las salas en las que ya está. */
function MisSalas({ servicio }: MisSalasProps) {
  const [codigo, setCodigo] = useState('')
  const [salas, setSalas] = useState<SalaConResumen[] | null>(null)

  useEffect(() => {
    let cancelado = false
    servicio.listar().then(
      (lista) => !cancelado && setSalas(lista),
      (error: unknown) => {
        console.error('No se pudieron cargar tus salas', error)
        if (!cancelado) setSalas([])
      },
    )
    return () => {
      cancelado = true
    }
  }, [servicio])

  return (
    <div className="flex w-full max-w-md flex-col items-center gap-8">
      <FormularioCuenta
        icono="🏫"
        titulo="Unirme a una sala"
        subtitulo="Escribe el código que te dio tu docente."
        textoBoton="🚪 Entrar a la sala"
        textoEnviando="Entrando…"
        validar={() =>
          esCodigoSalaValido(normalizarCodigoSala(codigo)) ? null : 'El código tiene 3 letras y 4 números, como MUL-4821.'
        }
        enviar={async () => {
          const sala = await servicio.unirse(normalizarCodigoSala(codigo))
          window.location.hash = routeToHash({ name: 'studentRoom', code: sala.codigo })
        }}
        errorPorDefecto="No se pudo entrar a la sala. Inténtalo de nuevo."
        pie={<EnlaceTexto href="#/cuenta">⬅ Mi cuenta</EnlaceTexto>}
      >
        <CampoTexto
          etiqueta="Código de la sala"
          value={codigo}
          onChange={(e) => setCodigo(normalizarCodigoSala(e.target.value))}
          placeholder="MUL-4821"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          autoFocus
          className="text-center font-mono text-2xl tracking-[0.2em] uppercase"
        />
      </FormularioCuenta>

      {salas && salas.length > 0 && (
        <section className="w-full text-left">
          <h2 className="mb-3 text-sm font-semibold tracking-widest text-amber-200 uppercase">Tus salas</h2>
          <ul className="flex flex-col gap-3" aria-label="Tus salas">
            {salas.map((sala) => (
              <li key={sala.id}>
                <a
                  href={routeToHash({ name: 'studentRoom', code: sala.codigo })}
                  className="flex items-center gap-4 rounded-2xl bg-white px-4 py-3 shadow-[0_5px_0_0_rgba(0,0,0,0.15)] transition-transform hover:-translate-y-0.5 focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-white"
                >
                  <span className="text-3xl" aria-hidden="true">
                    {ICONO_TEMA[sala.tema]}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold text-indigo-950">{sala.nombre}</span>
                    <span className="block text-sm text-indigo-500">
                      <span className="font-mono">{sala.codigo}</span> · {NOMBRE_TEMA[sala.tema]}
                      {sala.docente_nombre && ` · ${sala.docente_nombre}`}
                    </span>
                  </span>
                  <EstadoSalaInsignia abierta={sala.estado === 'abierta'} />
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

export default MisSalas
