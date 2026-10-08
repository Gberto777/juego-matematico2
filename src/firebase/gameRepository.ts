import { deleteDoc, doc, getDoc, serverTimestamp, setDoc, type Firestore } from 'firebase/firestore'
import { parseProgress, type GameRepository } from '../utils/storage'

/**
 * Repositorio de Firestore:
 * - `users/{uid}` → `{ records }`: récords personales (compartidos entre todos los modos).
 * - `users/{uid}/saves/{slot}` → `{ state }`: partida en curso. Hay un slot por modo
 *   ("solo", "sala-ABC123") para que una partida de clase no se mezcle con la individual.
 */
export function createFirestoreRepository(db: Firestore, uid: string, slot: string): GameRepository {
  const userRef = doc(db, 'users', uid)
  const saveRef = doc(db, 'users', uid, 'saves', slot)

  return {
    async load() {
      const [user, save] = await Promise.all([getDoc(userRef), getDoc(saveRef)])
      return parseProgress(user.get('records'), save.get('state'))
    },
    async saveRecords(records) {
      await setDoc(userRef, { records, updatedAt: serverTimestamp() }, { merge: true })
    },
    async saveGame(state) {
      await setDoc(saveRef, { state, updatedAt: serverTimestamp() })
    },
    async clearSavedGame() {
      await deleteDoc(saveRef)
    },
  }
}
