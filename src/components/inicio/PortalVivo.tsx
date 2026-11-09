import { useEffect, useRef, useState } from 'react'
import type { Operator } from '../../utils/mathUtils'
import { ACIERTOS_POR_REGION, REGIONES, crearPortal, nivelPorAciertos, type Portal } from '../../utils/portales'

const SIMBOLO: Record<Operator, string> = { '+': '+', '-': '−', '×': '×' }
const ACIERTOS_HASTA_EL_CASTILLO = ACIERTOS_POR_REGION * 4
/** Tiempo para ver si la puerta era la buena antes de la siguiente operación. */
const PAUSA_MS = 900

const texto = (p: Portal) => `${p.ecuacion.left} ${SIMBOLO[p.ecuacion.operator]} ${p.ecuacion.right}`

/**
 * El primer portal de MathQuest, jugable en la portada: tres puertas y una sola correcta.
 * Cada dos aciertos el portal pasa a la región siguiente y cambia de color.
 */
function PortalVivo({ crear = crearPortal }: { crear?: typeof crearPortal }) {
  const [aciertos, setAciertos] = useState(0)
  const [portal, setPortal] = useState(() => crear(1))
  const [elegida, setElegida] = useState<number | null>(null)
  const [mensaje, setMensaje] = useState('Toca la puerta con el resultado.')
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null)
  const nivel = nivelPorAciertos(aciertos)
  const region = REGIONES[nivel - 1]

  useEffect(() => () => {
    if (temporizador.current) clearTimeout(temporizador.current)
  }, [])

  const elegir = (valor: number) => {
    if (elegida !== null) return
    const bien = valor === portal.ecuacion.answer
    const nuevos = bien ? aciertos + 1 : aciertos
    const nivelNuevo = nivelPorAciertos(nuevos)
    setElegida(valor)

    if (!bien) {
      setMensaje(`Casi. ${texto(portal)} = ${portal.ecuacion.answer}. Prueba con la siguiente.`)
    } else if (nuevos === ACIERTOS_HASTA_EL_CASTILLO) {
      setMensaje('¡Llegaste al Castillo del Caos! En el juego te espera el Rey.')
    } else if (nivelNuevo > nivel) {
      setMensaje(`¡Bien! Entras en el ${REGIONES[nivelNuevo - 1].nombre}.`)
    } else {
      setMensaje(`¡Bien! ${texto(portal)} = ${portal.ecuacion.answer}.`)
    }

    temporizador.current = setTimeout(() => {
      setAciertos(nuevos)
      setPortal(crear(nivelNuevo, Math.random, portal.ecuacion))
      setElegida(null)
    }, PAUSA_MS)
  }

  return (
    <div className="mq-portal" data-nivel={nivel} aria-labelledby="portal-pregunta">
      <p className="mq-portal-region">{region.nombre}</p>
      <p id="portal-pregunta" className="mq-portal-pregunta" aria-live="polite">
        {texto(portal)} = ?
      </p>
      <div className="mq-puertas" role="group" aria-label="Elige la puerta con la respuesta">
        {portal.opciones.map((opcion) => (
          <button
            key={`${texto(portal)}-${opcion}`}
            type="button"
            className="mq-puerta"
            onClick={() => elegir(opcion)}
            disabled={elegida !== null && elegida !== opcion}
            data-resultado={elegida === opcion ? (opcion === portal.ecuacion.answer ? 'bien' : 'mal') : undefined}
          >
            {opcion}
          </button>
        ))}
      </div>
      <p className="mq-portal-estado" role="status">
        {mensaje}
      </p>
      <div className="mq-progreso" aria-label={`${Math.min(aciertos, ACIERTOS_HASTA_EL_CASTILLO)} de ${ACIERTOS_HASTA_EL_CASTILLO} aciertos hasta el castillo`}>
        {Array.from({ length: ACIERTOS_HASTA_EL_CASTILLO }, (_, i) => (
          <span key={i} data-lleno={i < aciertos ? '' : undefined} />
        ))}
      </div>
    </div>
  )
}

export default PortalVivo
