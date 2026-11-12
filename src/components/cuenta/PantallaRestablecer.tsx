import { useState } from 'react'
import { useAuth } from '../../auth/contexto'
import { PASSWORD_MAX, errorConfirmacion, errorPassword, primerError } from '../../utils/validacionCuenta'
import StatusMessage from '../StatusMessage'
import { CampoTexto, EnlaceTexto, FormularioCuenta } from './Formulario'

/**
 * Elegir una contraseña nueva. Se llega desde el enlace del correo de recuperación (que inicia
 * sesión) o desde "Mi cuenta" → Cambiar contraseña.
 */
function PantallaRestablecer() {
  const { cambiarPassword } = useAuth()
  const [password, setPassword] = useState('')
  const [confirmacion, setConfirmacion] = useState('')
  const [listo, setListo] = useState(false)

  if (listo) {
    return (
      <StatusMessage icon="✅" title="Contraseña cambiada">
        <p>Ya puedes usar tu contraseña nueva en la web, la app y el juego.</p>
        <EnlaceTexto href="#/cuenta">Ir a mi cuenta</EnlaceTexto>
      </StatusMessage>
    )
  }

  return (
    <FormularioCuenta
      icono="🔏"
      titulo="Nueva contraseña"
      textoBoton="💾 Guardar contraseña"
      textoEnviando="Guardando…"
      validar={() => primerError(errorPassword(password), errorConfirmacion(password, confirmacion))}
      enviar={async () => {
        await cambiarPassword(password)
        setListo(true)
      }}
      errorPorDefecto="No se pudo cambiar la contraseña. Inténtalo de nuevo."
      pie={<EnlaceTexto href="#/cuenta">⬅ Volver a mi cuenta</EnlaceTexto>}
    >
      <CampoTexto
        etiqueta="Contraseña nueva (mínimo 8)"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        maxLength={PASSWORD_MAX}
        autoComplete="new-password"
        autoFocus
      />
      <CampoTexto
        etiqueta="Repite la contraseña"
        type="password"
        value={confirmacion}
        onChange={(e) => setConfirmacion(e.target.value)}
        maxLength={PASSWORD_MAX}
        autoComplete="new-password"
      />
    </FormularioCuenta>
  )
}

/** Si se abre sin sesión: el enlace del correo caducó o ya se usó. */
export function EnlaceRecuperacionInvalido() {
  return (
    <StatusMessage icon="⌛" title="El enlace no es válido">
      <p>Puede que haya caducado o que ya se haya usado. Pide uno nuevo.</p>
      <EnlaceTexto href="#/recuperar">Pedir otro enlace</EnlaceTexto>
    </StatusMessage>
  )
}

export default PantallaRestablecer
