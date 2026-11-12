import type { ButtonHTMLAttributes } from 'react'

type SecondaryButtonProps = ButtonHTMLAttributes<HTMLButtonElement>

/** Botón translúcido para acciones secundarias sobre el fondo de color. */
function SecondaryButton({ className = '', children, ...props }: SecondaryButtonProps) {
  return (
    <button
      type="button"
      className={`rounded-full px-6 py-2 text-lg font-semibold text-white/90 ring-2 ring-white/40 transition-colors hover:bg-white/15 focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

export default SecondaryButton
