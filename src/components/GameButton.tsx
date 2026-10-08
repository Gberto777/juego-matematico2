import type { ButtonHTMLAttributes } from 'react'

type GameButtonProps = ButtonHTMLAttributes<HTMLButtonElement>

/** Botón grande y redondeado con efecto de "pulsado" 3D. */
function GameButton({ className = '', children, ...props }: GameButtonProps) {
  return (
    <button
      type="button"
      className={`rounded-full bg-amber-400 px-10 py-4 text-2xl font-bold text-amber-950 shadow-[0_6px_0_0_var(--color-amber-600)] transition-all hover:-translate-y-0.5 hover:bg-amber-300 hover:shadow-[0_8px_0_0_var(--color-amber-600)] focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-white active:translate-y-1.5 active:shadow-none sm:text-3xl ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

export default GameButton
