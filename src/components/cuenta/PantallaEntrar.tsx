import { useState } from 'react'
import { useAuth } from '../../auth/contexto'
import { errorEmail, primerError } from '../../utils/validacionCuenta'
import { CampoTexto, EnlaceTexto, FormularioCuenta } from './Formulario'

interface PantallaEntrarProps {
  /** Aviso sobre el formulario, p. ej. cuando se intenta abrir una página protegida. */
  aviso?: string
}

function PantallaEntrar({ aviso }: PantallaEntrarProps) {
  const { iniciarSesion } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  return (
    <FormularioCuenta
      icono="🔑"
      titulo="Entrar"
      subtitulo={aviso ?? 'Usa tu cuenta de MathQuest: la misma en la web, la app y el juego.'}
      textoBoton="🚪 Entrar"
      textoEnviando="Entrando…"
      validar={() => primerError(errorEmail(email), password ? null : 'Escribe tu contraseña.')}
      // Al entrar, el contexto de sesión cambia y la pantalla se sustituye sola.
      enviar={() => iniciarSesion(email, password)}
      errorPorDefecto="No se pudo entrar. Inténtalo de nuevo."
      pie={
        <>
          <EnlaceTexto href="#/recuperar">¿Olvidaste tu contraseña?</EnlaceTexto>
          <p>
            ¿No tienes cuenta? <EnlaceTexto href="#/registro">Créala aquí</EnlaceTexto>
          </p>
          <EnlaceTexto href="#/">⬅ Volver al juego</EnlaceTexto>
        </>
      }
    >
      <CampoTexto
        etiqueta="Correo"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="email"
        placeholder="ana@colegio.edu"
        autoFocus
      />
      <CampoTexto
        etiqueta="Contraseña"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="current-password"
      />
    </FormularioCuenta>
  )
}

export default PantallaEntrar
