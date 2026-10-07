import { ButtonHTMLAttributes, forwardRef } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size    = 'sm' | 'md' | 'lg'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
}

const base = 'inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none'

const variants: Record<Variant, string> = {
  primary:   'bg-primary-600 hover:bg-primary-700 text-white focus:ring-primary-500',
  secondary: 'bg-surface-700 hover:bg-surface-600 text-surface-100 focus:ring-surface-500',
  ghost:     'text-surface-300 hover:text-white hover:bg-surface-700 focus:ring-surface-500',
  danger:    'bg-red-600 hover:bg-red-700 text-white focus:ring-red-500',
}

const sizes: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-5 py-2.5 text-sm',
  lg: 'px-7 py-3.5 text-base',
}

const Button = forwardRef<HTMLButtonElement, Props>(
  ({ variant = 'primary', size = 'md', loading = false, children, ...rest }, ref) => (
    <button ref={ref} className={`${base} ${variants[variant]} ${sizes[size]}`} disabled={loading || rest.disabled} {...rest}>
      {loading && (
        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      )}
      {children}
    </button>
  ),
)
Button.displayName = 'Button'
export default Button
