import { initializeApp, type FirebaseApp } from 'firebase/app'
import { connectAuthEmulator, getAuth, signInAnonymously, signOut, type Auth, type User } from 'firebase/auth'
import {
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore'

const env = import.meta.env

const config = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
}

const useEmulators = env.VITE_FIREBASE_USE_EMULATORS === 'true'

/** Sin configuración (p. ej. falta el .env.local) la app funciona en modo local sin guardar. */
export const isFirebaseConfigured = Boolean(config.projectId && (config.apiKey || useEmulators))

export interface FirebaseServices {
  app: FirebaseApp
  auth: Auth
  db: Firestore
}

let services: FirebaseServices | null = null

export function getFirebase(): FirebaseServices {
  if (services) return services
  if (!isFirebaseConfigured) {
    throw new Error('Firebase no está configurado: copia .env.example a .env.local y rellena los valores.')
  }

  const app = initializeApp({ ...config, apiKey: config.apiKey || 'demo-key' })
  const auth = getAuth(app)
  // Caché persistente: en el aula la wifi falla a menudo; las escrituras se encolan y se envían al reconectar.
  const db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  })

  if (useEmulators) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
    connectFirestoreEmulator(db, '127.0.0.1', 8080)
  }

  services = { app, auth, db }
  return services
}

// Errores con los que la sesión guardada ya no sirve (p. ej. el usuario anónimo se borró en la consola).
const DEAD_SESSION_CODES = new Set(['auth/user-token-expired', 'auth/user-disabled', 'auth/user-not-found', 'auth/invalid-user-token'])

let pendingSignIn: Promise<User> | null = null

async function signIn(auth: Auth): Promise<User> {
  await auth.authStateReady()
  const saved = auth.currentUser
  if (saved) {
    try {
      // Sin un token válido Firestore enviaría las peticiones sin request.auth y las reglas las rechazarían.
      await saved.getIdToken()
      return saved
    } catch (error) {
      if (!DEAD_SESSION_CODES.has((error as { code?: string }).code ?? '')) throw error
      console.warn('La sesión guardada ya no es válida; se crea una nueva.', error)
      await signOut(auth)
    }
  }
  const { user } = await signInAnonymously(auth)
  await user.getIdToken()
  return user
}

/**
 * Devuelve el usuario actual con un token válido, iniciando sesión anónima si hace falta.
 * La sesión se conserva en el navegador, así que alumno y profesor mantienen su identidad al recargar.
 */
export function ensureSignedIn(): Promise<User> {
  const { auth } = getFirebase()
  pendingSignIn ??= signIn(auth).finally(() => {
    pendingSignIn = null
  })
  return pendingSignIn
}

/** Mensaje para el usuario a partir de un error de Firestore. */
export function describeFirestoreError(error: unknown, fallback: string): string {
  const code = (error as { code?: string } | null)?.code
  if (code === 'permission-denied') {
    return `${fallback} Firestore rechazó la operación: comprueba que las reglas están publicadas (npm run deploy:rules).`
  }
  if (code === 'unavailable') return `${fallback} No hay conexión con el servidor.`
  return fallback
}
