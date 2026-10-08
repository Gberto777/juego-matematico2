import { useEffect, useState } from 'react'
import { ensureSignedIn, isFirebaseConfigured } from '../firebase/app'

export type FirebaseUserState =
  | { status: 'disabled' }
  | { status: 'loading' }
  | { status: 'ready'; uid: string }
  | { status: 'error'; error: Error }

/** Inicia sesión anónima en Firebase. Alumnos y profesores se identifican por este uid. */
export function useFirebaseUser(): FirebaseUserState {
  const [state, setState] = useState<FirebaseUserState>(
    isFirebaseConfigured ? { status: 'loading' } : { status: 'disabled' },
  )

  useEffect(() => {
    if (!isFirebaseConfigured) return
    let cancelled = false
    ensureSignedIn().then(
      (user) => !cancelled && setState({ status: 'ready', uid: user.uid }),
      (error: unknown) => {
        console.error('No se pudo iniciar sesión en Firebase', error)
        if (!cancelled) setState({ status: 'error', error: error instanceof Error ? error : new Error(String(error)) })
      },
    )
    return () => {
      cancelled = true
    }
  }, [])

  return state
}
