import StatusMessage from '../StatusMessage'
import { EnlaceTexto } from './Formulario'

/*
 * Entradas de los paneles protegidos por rol. Su contenido llega en las fases siguientes
 * (fase 3: usuarios; fase 4: salas); de momento confirman que el acceso por rol funciona.
 */

export function PanelAdmin() {
  return (
    <StatusMessage icon="🛠️" title="Panel de administración">
      <p>Aquí podrás crear, editar y desactivar usuarios, y ver las estadísticas del sistema.</p>
      <EnlaceTexto href="#/cuenta">⬅ Volver a mi cuenta</EnlaceTexto>
    </StatusMessage>
  )
}

export function PanelDocente() {
  return (
    <StatusMessage icon="👩‍🏫" title="Panel docente">
      <p>Aquí podrás crear salas con código, asignar retos y ver el progreso de tus alumnos.</p>
      <EnlaceTexto href="#/cuenta">⬅ Volver a mi cuenta</EnlaceTexto>
    </StatusMessage>
  )
}
