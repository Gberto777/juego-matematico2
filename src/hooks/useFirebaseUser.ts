import { useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { ensureSignedIn, getFirebase, isFirebaseConfigured } from '../firebase/app'

export type FirebaseUserState =
  | { status: 'disabled' }
  | { status: 'loading' }
  | { status: 'ready'; uid: string }
  | { status: 'error'; error: Error }

/**
 * Inicia sesión anónima en Firebase. Alumnos y profesores se identifican por este uid.
 * Solo pasa a 'ready' cuando hay un usuario con token válido, así que las pantallas que
 * leen o escriben en Firestore (envueltas en RequireUser) nunca lo hacen sin autenticar.
 */
export function useFirebaseUser(): FirebaseUserState {
  const [state, setState] = useState<FirebaseUserState>(
    isFirebaseConfigured ? { status: 'loading' } : { status: 'disabled' },
  )

  useEffect(() => {
    if (!isFirebaseConfigured) return
    let cancelled = false

    const signIn = () =>
      ensureSignedIn().then(
        (user) => !cancelled && setState({ status: 'ready', uid: user.uid }),
        (error: unknown) => {
          console.error('No se pudo iniciar sesión en Firebase', error)
          if (!cancelled) setState({ status: 'error', error: error instanceof Error ? error : new Error(String(error)) })
        },
      )

    signIn()

    // Si la sesión se pierde o cambia, se vuelve a esperar a un usuario válido.
    const unsubscribe = onAuthStateChanged(getFirebase().auth, (user) => {
      if (cancelled) return
      if (user) {
        // Mientras se inicia sesión, 'ready' lo pone ensureSignedIn cuando ya hay token.
        setState((prev) => (prev.status === 'ready' && prev.uid !== user.uid ? { status: 'ready', uid: user.uid } : prev))
      } else {
        setState({ status: 'loading' })
        signIn()
      }
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  return state
}
