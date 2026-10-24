'use client'

import {
  ButtonHTMLAttributes,
  ComponentProps,
  forwardRef,
  ReactNode,
  useEffect,
  useRef,
} from 'react'
import { Loader2, X } from 'lucide-react'

export function Button({
  variant = 'primary',
  busy = false,
  className = '',
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  busy?: boolean
}) {
  const variants = {
    primary: 'bg-primary text-on-primary border-primary hover:bg-primary-hover shadow-xs',
    secondary: 'bg-surface text-ink border-line hover:bg-muted',
    ghost: 'bg-transparent text-subtle border-transparent hover:bg-muted hover:text-ink',
    danger: 'bg-danger-soft text-danger border-danger/20 hover:bg-danger/10',
  }
  return (
    <button
      {...props}
      disabled={disabled || busy}
      className={`inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold transition-all disabled:pointer-events-none disabled:opacity-50 ${variants[variant]} ${className}`}
    >
      {busy && <Loader2 size={16} className="animate-spin" />}
      {children}
    </button>
  )
}

export const Input = forwardRef<HTMLInputElement, ComponentProps<'input'>>(function Input(
  { className = '', ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      {...props}
      className={`min-h-11 w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm text-ink outline-none placeholder:text-faint focus:border-primary focus:ring-3 focus:ring-primary/10 ${className}`}
    />
  )
})

export function Select({ className = '', ...props }: ComponentProps<'select'>) {
  return (
    <select
      {...props}
      className={`min-h-10 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-subtle outline-none focus:border-primary focus:ring-3 focus:ring-primary/10 ${className}`}
    />
  )
}

export function Badge({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] leading-none font-semibold tracking-wide ${className}`}
    >
      {children}
    </span>
  )
}

export function Progress({
  value,
  className = '',
  color = 'bg-primary',
}: {
  value: number
  className?: string
  color?: string
}) {
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.max(0, Math.min(value, 100))}
      aria-valuemin={0}
      aria-valuemax={100}
      className={`h-1.5 overflow-hidden rounded-full bg-muted ${className}`}
    >
      <div
        className={`h-full rounded-full transition-all duration-500 ${color}`}
        style={{ width: `${Math.max(0, Math.min(value, 100))}%` }}
      />
    </div>
  )
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  label: string
  description?: string
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-5 py-3">
      <span>
        <span className="block text-sm font-medium text-ink">{label}</span>
        {description && (
          <span className="mt-1 block text-xs leading-relaxed text-subtle">{description}</span>
        )}
      </span>
      <span className="relative shrink-0">
        <input
          aria-label={label}
          type="checkbox"
          className="peer sr-only"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="block h-6 w-11 rounded-full bg-line transition-colors peer-checked:bg-primary peer-focus-visible:ring-3 peer-focus-visible:ring-primary/30" />
        <span
          className={`absolute top-1 block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`}
        />
      </span>
    </label>
  )
}

export function Modal({
  children,
  title,
  onClose,
  wide = false,
  drawer = false,
}: {
  children: ReactNode
  title: string
  onClose: () => void
  wide?: boolean
  drawer?: boolean
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    dialog?.showModal()
    const onCancel = (event: Event) => {
      event.preventDefault()
      onClose()
    }
    dialog?.addEventListener('cancel', onCancel)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      dialog?.removeEventListener('cancel', onCancel)
      document.body.style.overflow = previous
    }
  }, [onClose])
  return (
    <dialog
      ref={ref}
      aria-label={title}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      className={`fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto rounded-2xl border border-line bg-surface p-0 text-ink shadow-2xl backdrop:bg-slate-950/45 backdrop:backdrop-blur-sm ${wide ? 'max-w-2xl' : 'max-w-lg'} ${drawer ? 'max-sm:top-auto max-sm:mx-0 max-sm:mb-0 max-sm:w-full max-sm:rounded-b-none' : ''}`}
    >
      <div className="flex items-center justify-between border-b border-line px-6 py-5">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        <Button
          variant="ghost"
          aria-label="Close dialog"
          className="min-h-8 p-1.5"
          onClick={onClose}
        >
          <X size={20} />
        </Button>
      </div>
      {children}
    </dialog>
  )
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-line bg-surface px-6 py-14 text-center">
      <span className="mb-4 flex size-13 items-center justify-center rounded-2xl bg-primary-soft text-primary">
        {icon}
      </span>
      <h3 className="text-lg font-semibold text-ink">{title}</h3>
      <p className="mt-2 max-w-md text-sm leading-6 text-subtle">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}
