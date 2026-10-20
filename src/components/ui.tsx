import * as RTooltip from '@radix-ui/react-tooltip'
import type { LucideIcon } from 'lucide-react'
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

export function Tooltip({ label, shortcut, children, side = 'bottom' }: { label: string; shortcut?: string; children: ReactNode; side?: 'top' | 'bottom' | 'left' | 'right' }) {
  return (
    <RTooltip.Root>
      <RTooltip.Trigger asChild>{children}</RTooltip.Trigger>
      <RTooltip.Portal>
        <RTooltip.Content
          side={side}
          sideOffset={6}
          className="animate-in z-[var(--z-popover)] flex items-center gap-2 rounded-[var(--radius-sm)] bg-fg px-2 py-1 text-[var(--text-sm)] text-surface shadow-[var(--shadow-md)]"
        >
          {label}
          {shortcut && <kbd className="rounded bg-surface/20 px-1 font-mono text-[var(--text-xs)]">{shortcut}</kbd>}
        </RTooltip.Content>
      </RTooltip.Portal>
    </RTooltip.Root>
  )
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md'
  icon?: LucideIcon
}

export const Button = forwardRef<HTMLButtonElement, BtnProps>(function Button(
  { variant = 'secondary', size = 'md', icon: Icon, className, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cx(
        'inline-flex shrink-0 items-center justify-center gap-1.5 rounded-[var(--radius-sm)] font-medium whitespace-nowrap transition-colors duration-[var(--motion-fast)] disabled:pointer-events-none disabled:opacity-45',
        size === 'sm' ? 'h-7 px-2 text-[var(--text-sm)]' : 'h-8 px-3 text-[var(--text-md)]',
        variant === 'primary' && 'bg-primary text-on-primary shadow-[var(--shadow-sm)] hover:bg-primary-hover',
        variant === 'secondary' && 'border border-border bg-surface text-fg shadow-[var(--shadow-sm)] hover:bg-surface-hover',
        variant === 'ghost' && 'text-muted hover:bg-surface-hover hover:text-fg',
        variant === 'danger' && 'text-danger hover:bg-surface-hover',
        className,
      )}
      {...rest}
    >
      {Icon && <Icon size={size === 'sm' ? 14 : 16} strokeWidth={2} aria-hidden />}
      {children}
    </button>
  )
})

type IconBtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: LucideIcon
  label: string
  shortcut?: string
  active?: boolean
  size?: 'sm' | 'md'
  tooltipSide?: 'top' | 'bottom' | 'left' | 'right'
}

export function IconButton({ icon: Icon, label, shortcut, active, size = 'md', tooltipSide, className, ...rest }: IconBtnProps) {
  return (
    <Tooltip label={label} shortcut={shortcut} side={tooltipSide}>
      <button
        aria-label={label}
        aria-pressed={active}
        className={cx(
          'inline-flex shrink-0 items-center justify-center rounded-[var(--radius-sm)] transition-colors duration-[var(--motion-fast)] disabled:pointer-events-none disabled:opacity-40',
          size === 'sm' ? 'h-7 w-7' : 'h-8 w-8',
          active ? 'bg-primary-soft text-primary ring-1 ring-primary/35' : 'text-muted hover:bg-surface-hover hover:text-fg',
          className,
        )}
        {...rest}
      >
        <Icon size={size === 'sm' ? 15 : 17} strokeWidth={1.9} aria-hidden />
      </button>
    </Tooltip>
  )
}

export function Divider({ vertical = true }: { vertical?: boolean }) {
  return <div aria-hidden className={vertical ? 'mx-1 h-5 w-px bg-border' : 'my-1 h-px w-full bg-border'} />
}

export function Field({ label, children, htmlFor }: { label: string; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={htmlFor} className="text-[var(--text-xs)] font-medium tracking-wide text-muted uppercase">
        {label}
      </label>
      {children}
    </div>
  )
}

export const inputCls =
  'h-8 w-full rounded-[var(--radius-sm)] border border-border bg-surface px-2 text-[var(--text-md)] text-fg outline-none transition-colors placeholder:text-subtle focus:border-primary focus:ring-2 focus:ring-primary/20'

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded border border-border bg-surface-2 px-1.5 py-0.5 font-mono text-[var(--text-xs)] text-muted">{children}</kbd>
}
