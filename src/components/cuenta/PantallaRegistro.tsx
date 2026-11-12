import { useState } from 'react'
import { useAuth } from '../../auth/contexto'
import {
  NOMBRE_MAX,
  PASSWORD_MAX,
  errorConfirmacion,
  errorEmail,
  errorNombre,
  errorPassword,
  primerError,
} from '../../utils/validacionCuenta'
import StatusMessage from '../StatusMessage'
import { CampoTexto, EnlaceTexto, FormularioCuenta } from './Formulario'

function PantallaRegistro() {
  const { registrarse } = useAuth()
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmacion, setConfirmacion] = useState('')
  const [revisarCorreo, setRevisarCorreo] = useState(false)

  if (revisarCorreo) {
    return (
      <StatusMessage icon="📬" title="Revisa tu correo">
        <p>
          Te enviamos un enlace a <strong className="text-white">{email.trim()}</strong> para confirmar tu cuenta. Ábrelo y
          luego entra con tu contraseña.
        </p>
        <EnlaceTexto href="#/entrar">Ir a entrar</EnlaceTexto>
      </StatusMessage>
    )
  }

  return (
    <FormularioCuenta
      icono="✨"
      titulo="Crear cuenta"
      subtitulo="Guarda tu progreso y únete a las salas de tu clase."
      textoBoton="🚀 Crear cuenta"
      textoEnviando="Creando…"
      validar={() =>
        primerError(errorNombre(nombre), errorEmail(email), errorPassword(password), errorConfirmacion(password, confirmacion))
      }
      enviar={async () => {
        const { necesitaConfirmar } = await registrarse(email, password, nombre)
        // Si no hace falta confirmar, ya hay sesión y la pantalla cambia sola a "Mi cuenta".
        if (necesitaConfirmar) setRevisarCorreo(true)
      }}
      errorPorDefecto="No se pudo crear la cuenta. Inténtalo de nuevo."
      pie={
        <>
          <p>
            ¿Ya tienes cuenta? <EnlaceTexto href="#/entrar">Entra aquí</EnlaceTexto>
          </p>
          <EnlaceTexto href="#/">⬅ Volver al juego</EnlaceTexto>
        </>
      }
    >
      <CampoTexto
        etiqueta="Tu nombre"
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        maxLength={NOMBRE_MAX}
        autoComplete="name"
        placeholder="Ana García"
        autoFocus
      />
      <CampoTexto
        etiqueta="Correo"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="email"
        placeholder="ana@colegio.edu"
      />
      <CampoTexto
        etiqueta="Contraseña (mínimo 8)"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        maxLength={PASSWORD_MAX}
        autoComplete="new-password"
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

export default PantallaRegistro
