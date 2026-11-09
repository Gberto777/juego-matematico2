import StatusMessage from '../StatusMessage'
import { EnlaceTexto } from './Formulario'

/*
 * Entrada del panel docente, protegida por rol. Su contenido (salas con código, retos y progreso
 * de los alumnos) llega en la fase 4; de momento confirma que el acceso por rol funciona.
 */
export function PanelDocente() {
  return (
    <StatusMessage icon="👩‍🏫" title="Panel docente">
      <p>Aquí podrás crear salas con código, asignar retos y ver el progreso de tus alumnos.</p>
      <EnlaceTexto href="#/cuenta">⬅ Volver a mi cuenta</EnlaceTexto>
    </StatusMessage>
  )
}
