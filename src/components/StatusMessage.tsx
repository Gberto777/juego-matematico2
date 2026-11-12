import type { ReactNode } from 'react'

interface StatusMessageProps {
  icon: string
  title: string
  children?: ReactNode
}

/** Mensaje centrado para cargas, errores y estados vacíos. */
function StatusMessage({ icon, title, children }: StatusMessageProps) {
  return (
    <section className="flex max-w-md animate-pop flex-col items-center gap-4 text-center" role="status">
      <div className="text-6xl" aria-hidden="true">
        {icon}
      </div>
      <h1 className="text-3xl font-bold text-white drop-shadow-[0_3px_0_rgba(0,0,0,0.2)]">{title}</h1>
      {children && <div className="flex flex-col items-center gap-4 text-lg text-indigo-100">{children}</div>}
    </section>
  )
}

export default StatusMessage
