import { useCallback } from 'react'
import { useCarga } from '../../hooks/useCarga'
import type { ServicioEstadisticas } from '../../supabase/servicioEstadisticas'
import type { ApiPartidas } from '../../supabase/servicioSalas'
import SecondaryButton from '../SecondaryButton'
import SoloGame from '../SoloGame'
import StatusMessage from '../StatusMessage'

/** #/reto-diario: la práctica rápida con el reto del día (mismo reto para todos, cambia cada día). */
function JuegoRetoDiario({ estadisticas, api }: { estadisticas: ServicioEstadisticas; api: ApiPartidas | null }) {
  const [carga, recargar] = useCarga(useCallback(() => estadisticas.retoDiario(), [estadisticas]))

  if (carga.estado === 'cargando') return <StatusMessage icon="⏳" title="Cargando el reto del día…" />
  if (carga.estado === 'error') {
    return (
      <StatusMessage icon="📡" title="No se pudo cargar el reto del día">
        <p>{carga.mensaje}</p>
        <SecondaryButton onClick={recargar}>🔄 Reintentar</SecondaryButton>
      </StatusMessage>
    )
  }
  // Sin Firebase: el reto del día se guarda solo en Supabase.
  return <SoloGame uid={null} onJoinClass={() => {}} onTeacher={() => {}} api={api} diario={carga.datos} />
}

export default JuegoRetoDiario
