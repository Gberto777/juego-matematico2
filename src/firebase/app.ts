import { initializeApp, type FirebaseApp } from 'firebase/app'
import { connectAuthEmulator, getAuth, signInAnonymously, type Auth, type User } from 'firebase/auth'
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

/**
 * Devuelve el usuario actual, iniciando sesión anónima si hace falta. La sesión se
 * conserva en el navegador, así que alumno y profesor mantienen su identidad al recargar.
 */
export async function ensureSignedIn(): Promise<User> {
  const { auth } = getFirebase()
  await auth.authStateReady()
  return auth.currentUser ?? (await signInAnonymously(auth)).user
}
