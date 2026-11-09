import { useState } from 'react'
import { useAuth } from '../../auth/contexto'
import { errorEmail } from '../../utils/validacionCuenta'
import StatusMessage from '../StatusMessage'
import { CampoTexto, EnlaceTexto, FormularioCuenta } from './Formulario'

function PantallaRecuperar() {
  const { enviarRecuperacion } = useAuth()
  const [email, setEmail] = useState('')
  const [enviado, setEnviado] = useState(false)

  if (enviado) {
    return (
      <StatusMessage icon="📬" title="Revisa tu correo">
        {/* Mismo mensaje exista o no la cuenta: así no se puede averiguar quién está registrado. */}
        <p>
          Si hay una cuenta con <strong className="text-white">{email.trim()}</strong>, te llegará un enlace para elegir
          una contraseña nueva. Puede tardar unos minutos.
        </p>
        <EnlaceTexto href="#/entrar">Volver a entrar</EnlaceTexto>
      </StatusMessage>
    )
  }

  return (
    <FormularioCuenta
      icono="🔐"
      titulo="Recuperar contraseña"
      subtitulo="Escribe tu correo y te enviaremos un enlace para elegir una nueva."
      textoBoton="📨 Enviar enlace"
      textoEnviando="Enviando…"
      validar={() => errorEmail(email)}
      enviar={async () => {
        await enviarRecuperacion(email)
        setEnviado(true)
      }}
      errorPorDefecto="No se pudo enviar el correo. Inténtalo de nuevo."
      pie={<EnlaceTexto href="#/entrar">⬅ Volver a entrar</EnlaceTexto>}
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
    </FormularioCuenta>
  )
}

export default PantallaRecuperar
